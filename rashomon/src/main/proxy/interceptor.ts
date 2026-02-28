import crypto from "node:crypto";
import { URL } from "node:url";

import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { createAuditLogger, type AuditLogger } from "../audit/logger";
import { createReceiptService, type ReceiptService } from "../audit/receipt";
import { createDatabaseConnection, database, type DatabaseServices } from "../db/connection";
import { agents, requests } from "../db/schema";
import { createDomainManager, domainManager, type DomainManager } from "../engine/domain-manager";
import { createIntentAnalyzer, intentAnalyzer, type IntentAnalyzer } from "../engine/intent-analyzer";
import { createPolicyEngine, policyEngine, type PolicyEngine } from "../engine/policy-engine";
import { createRateLimiter, rateLimiter, type RateLimiter } from "../engine/rate-limiter";
import { createSecretScanner, secretScanner, type SecretScanner } from "../engine/secret-scanner";
import { createAgentDetector, agentDetector, type AgentDetector } from "./agent-detector";
import type {
  AgentRecord,
  InterceptionInput,
  InterceptionResult,
  PolicyViolation,
  RequestManifest,
  TrafficEvent,
} from "../../shared/types";

interface PendingRequest {
  agentId: string;
  domain: string;
}

type TrafficListener = (event: TrafficEvent) => void;

export interface RequestInterceptor {
  intercept: (input: InterceptionInput) => Promise<InterceptionResult>;
  finalize: (requestId: string, responseStatus: number, responseBodySize: number) => Promise<void>;
  onTraffic: (listener: TrafficListener) => () => void;
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveHeaders = new Set(["authorization", "cookie", "x-api-key", "proxy-authorization"]);
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      sensitiveHeaders.has(key.toLowerCase()) ? `${value.slice(0, 4)}...${value.slice(-4)}` : value,
    ]),
  );
}

function calculateThreatScore(manifest: RequestManifest): number {
  let score = manifest.risk.threatScore;
  score += manifest.why.secretsDetected.length * 35;
  score += manifest.where.isFirstContact ? 20 : 0;
  score += manifest.what.bodySize > 1_000_000 ? 20 : 0;
  score += manifest.why.policyViolations.some((violation) => violation.category === "rate_limit") ? 25 : 0;
  score += manifest.why.intentAnalysis ? manifest.why.intentAnalysis.mismatchScore * 0.5 : 0;
  if (manifest.where.domainStatus === "denied") {
    score += 50;
  }
  if (manifest.where.domainStatus === "pending_approval") {
    score += 25;
  }
  return Math.max(0, Math.min(100, score));
}

function defaultBlockStatus(action: InterceptionResult["action"]): number {
  switch (action) {
    case "block":
      return 403;
    case "require_approval":
      return 409;
    case "throttle":
      return 429;
    default:
      return 200;
  }
}

export function createRequestInterceptor(
  services: DatabaseServices = database,
  engine: PolicyEngine = policyEngine,
  domainsService: DomainManager = domainManager,
  limiter: RateLimiter = rateLimiter,
  scanner: SecretScanner = secretScanner,
  analyzer: IntentAnalyzer = intentAnalyzer,
  detector: AgentDetector = agentDetector,
  auditLogger: AuditLogger = createAuditLogger(services),
  receipts: ReceiptService = createReceiptService(services),
): RequestInterceptor {
  const pendingRequests = new Map<string, PendingRequest>();
  const listeners = new Set<TrafficListener>();

  async function resolveAgent(input: InterceptionInput): Promise<AgentRecord> {
    const headerAgentId = input.headers["x-rashomon-agent-id"] ?? uuidv4();
    const headerAgentName = input.headers["x-rashomon-agent-name"] ?? "unknown-agent";
    const headerProcessName = input.headers["x-rashomon-process-name"] ?? headerAgentName;
    const headerPid = Number(input.headers["x-rashomon-agent-pid"] ?? 0);
    const detectedAgent = Number.isFinite(headerPid) && headerPid > 0 ? await detector.getAgentForPid(headerPid) : null;

    const agent: AgentRecord = {
      id: detectedAgent?.id ?? headerAgentId,
      name: detectedAgent?.name ?? headerAgentName,
      processName: detectedAgent?.processName ?? headerProcessName,
      pid: detectedAgent?.pid ?? (Number.isFinite(headerPid) ? headerPid : null),
      declaredPurpose: detectedAgent?.declaredPurpose ?? null,
      firstSeen: new Date(),
      lastSeen: new Date(),
      status: "active",
      totalRequests: 0,
      blockedRequests: 0,
      threatScore: 0,
    };

    const existing = services.db.select().from(agents).where(eq(agents.id, agent.id)).get();
    if (existing) {
      services.db.update(agents).set({
        name: agent.name,
        processName: agent.processName,
        pid: agent.pid,
        lastSeen: new Date(),
      }).where(eq(agents.id, agent.id)).run();

      return {
        ...existing,
        lastSeen: new Date(),
      };
    }

    services.db.insert(agents).values(agent).run();
    await auditLogger.logEvent("agent_detected", { name: agent.name, processName: agent.processName }, { agentId: agent.id });

    return agent;
  }

  async function persistDecision(
    manifest: RequestManifest,
    headers: Record<string, string>,
    reason: string,
    policyRuleId?: string,
  ): Promise<InterceptionResult> {
    const requestId = uuidv4();
    const receipt = await receipts.generateDecisionReceipt({
      requestId,
      requestHash: manifest.what.bodyHash,
      decision: manifest.decision.action,
      reason,
      policyRuleId,
    });

    services.db.insert(requests).values({
      id: requestId,
      agentId: manifest.who.agentId,
      timestamp: new Date(manifest.decision.timestamp),
      method: manifest.what.method,
      url: manifest.what.url,
      domain: manifest.what.domain,
      port: manifest.where.port,
      requestHeaders: JSON.stringify(redactHeaders(headers)),
      requestBodySize: manifest.what.bodySize,
      requestBodyHash: manifest.what.bodyHash,
      requestBodyPreview: manifest.what.bodyPreview ?? null,
      responseStatus: manifest.decision.action === "allow" ? null : defaultBlockStatus(manifest.decision.action),
      responseBodySize: null,
      decision: manifest.decision.action,
      decisionReason: reason,
      policyRuleId: policyRuleId ?? null,
      threatScore: manifest.risk.threatScore,
      secretsDetected: JSON.stringify(manifest.why.secretsDetected.map((match) => match.type)),
      intentAnalysis: manifest.why.intentAnalysis ? JSON.stringify(manifest.why.intentAnalysis) : null,
      receiptHash: receipt.chainHash,
    }).run();

    const eventType =
      manifest.decision.action === "allow"
        ? "request_allowed"
        : manifest.decision.action === "throttle"
          ? "request_throttled"
          : manifest.decision.action === "require_approval"
            ? "approval_requested"
            : "request_blocked";

    await auditLogger.logEvent(
      eventType,
      {
        url: manifest.what.url,
        domain: manifest.what.domain,
        threatScore: manifest.risk.threatScore,
        reason,
      },
      {
        agentId: manifest.who.agentId,
        requestId,
      },
    );

    services.db.update(agents).set({
      lastSeen: new Date(),
      totalRequests: (services.db.select().from(agents).where(eq(agents.id, manifest.who.agentId)).get()?.totalRequests ?? 0) + 1,
      blockedRequests:
        (services.db.select().from(agents).where(eq(agents.id, manifest.who.agentId)).get()?.blockedRequests ?? 0) +
        (manifest.decision.action === "allow" ? 0 : 1),
      threatScore: manifest.risk.threatScore,
    }).where(eq(agents.id, manifest.who.agentId)).run();

    const trafficEvent: TrafficEvent = {
      requestId,
      timestamp: manifest.decision.timestamp,
      agentName: manifest.who.agentName,
      agentId: manifest.who.agentId,
      method: manifest.what.method,
      domain: manifest.what.domain,
      url: manifest.what.url,
      decision: manifest.decision.action,
      reason,
      threatScore: manifest.risk.threatScore,
      secretsDetected: manifest.why.secretsDetected.map((match) => match.type),
    };

    for (const listener of listeners) {
      listener(trafficEvent);
    }

    return {
      requestId,
      manifest: {
        ...manifest,
        decision: {
          ...manifest.decision,
          receiptHash: receipt.chainHash,
          reason,
          policyRuleId,
        },
      },
      agent: services.db.select().from(agents).where(eq(agents.id, manifest.who.agentId)).get() as AgentRecord,
      action: manifest.decision.action,
      statusCode: defaultBlockStatus(manifest.decision.action),
      responseHeaders: {
        "content-type": "application/json; charset=utf-8",
      },
      responseBody:
        manifest.decision.action === "allow"
          ? undefined
          : JSON.stringify({
              error: manifest.decision.action,
              reason,
              receiptHash: receipt.chainHash,
            }),
      targetUrl: manifest.what.url,
    };
  }

  return {
    async intercept(input) {
      if (engine.getPolicies().length === 0) {
        await engine.loadPolicies();
      }

      const target = new URL(input.url);
      const body = input.body ?? "";
      const headers = Object.fromEntries(
        Object.entries(input.headers).map(([key, value]) => [key.toLowerCase(), value]),
      );
      const agent = await resolveAgent(input);
      const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
      const secretsDetected = await scanner.scanRequest({ headers, body });
      const domainCheck = await domainsService.checkDomain(target.hostname);
      const rateLimitResult = await limiter.checkLimit(agent.id, target.hostname);
      const policyViolations: PolicyViolation[] = [];

      if (!rateLimitResult.allowed) {
        policyViolations.push({
          ruleId: rateLimitResult.exceededKey ?? "rate-limit",
          category: "rate_limit",
          message: rateLimitResult.reason,
          severity: "high",
        });
      }

      const manifest: RequestManifest = {
        who: {
          agentId: agent.id,
          agentName: agent.name,
          processName: agent.processName,
          pid: agent.pid ?? 0,
        },
        what: {
          method: input.method,
          url: target.toString(),
          domain: target.hostname,
          bodySize: Buffer.byteLength(body),
          bodyHash,
          contentType: headers["content-type"] ?? "application/octet-stream",
          dataClassification: secretsDetected.length > 0 ? "secret" : "internal",
          bodyPreview: body.slice(0, 500),
        },
        where: {
          domain: target.hostname,
          port: Number(target.port || (target.protocol === "https:" ? 443 : 80)),
          domainStatus: domainCheck.status,
          isFirstContact: domainCheck.isFirstContact,
        },
        why: {
          secretsDetected,
          policyViolations,
          anomalies: [],
        },
        risk: {
          threatScore: 0,
          factors: [],
        },
        decision: {
          action: "allow",
          reason: "Pending policy evaluation",
          timestamp: Date.now(),
          receiptHash: "",
        },
      };

      if (secretsDetected.length > 0) {
        manifest.risk.factors.push("Secrets detected in outbound content.");
      }
      if (domainCheck.isFirstContact) {
        manifest.risk.factors.push("First contact with destination domain.");
      }
      if (!rateLimitResult.allowed) {
        manifest.risk.factors.push("Rate limit exceeded.");
      }

      const decision = await engine.evaluateRequest(manifest);
      manifest.why.policyViolations = decision.violations;
      manifest.why.anomalies = decision.anomalies;
      manifest.decision.action = rateLimitResult.allowed ? decision.action : "throttle";
      manifest.decision.reason = rateLimitResult.allowed ? decision.reason : rateLimitResult.reason;

      if (analyzer.isEnabled() && (calculateThreatScore(manifest) > (analyzer.getConfig().threshold ?? 30))) {
        manifest.why.intentAnalysis = await analyzer.analyzeIntent(manifest);
        if (manifest.why.intentAnalysis.mismatchScore >= 60) {
          manifest.why.policyViolations.push({
            ruleId: "intent:mismatch",
            category: "intent",
            message: manifest.why.intentAnalysis.reasoning,
            severity: manifest.why.intentAnalysis.mismatchScore >= 85 ? "critical" : "high",
          });
          manifest.risk.factors.push("Intent analysis indicates a likely mismatch.");
        }
      }

      manifest.risk.threatScore = calculateThreatScore(manifest);
      const persisted = await persistDecision(manifest, headers, manifest.decision.reason, decision.policyRuleId);

      if (persisted.action === "allow") {
        pendingRequests.set(persisted.requestId, {
          agentId: agent.id,
          domain: target.hostname,
        });
      } else {
        limiter.complete(agent.id, target.hostname);
      }

      await domainsService.recordDomainContact(target.hostname, domainCheck.status);

      return persisted;
    },

    async finalize(requestId, responseStatus, responseBodySize) {
      const pending = pendingRequests.get(requestId);
      const existing = services.db.select().from(requests).where(eq(requests.id, requestId)).get();
      if (!existing) {
        return;
      }

      services.db.update(requests).set({
        responseStatus,
        responseBodySize,
      }).where(eq(requests.id, requestId)).run();

      if (pending) {
        limiter.complete(pending.agentId, pending.domain);
        pendingRequests.delete(requestId);
      }
    },

    onTraffic(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const defaultDatabase = createDatabaseConnection();
const defaultPolicyEngine = createPolicyEngine();
const defaultDomainManager = createDomainManager(defaultDatabase, defaultPolicyEngine);
const defaultRateLimiter = createRateLimiter(defaultPolicyEngine);
const defaultSecretScanner = createSecretScanner(defaultPolicyEngine);
const defaultIntentAnalyzer = createIntentAnalyzer();
const defaultAgentDetector = createAgentDetector(defaultPolicyEngine);

export const requestInterceptor = createRequestInterceptor(
  defaultDatabase,
  defaultPolicyEngine,
  defaultDomainManager,
  defaultRateLimiter,
  defaultSecretScanner,
  defaultIntentAnalyzer,
  defaultAgentDetector,
);
export const intercept = requestInterceptor.intercept;
