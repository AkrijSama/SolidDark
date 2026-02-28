import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAuditLogger } from "@main/audit/logger";
import { createReceiptService } from "@main/audit/receipt";
import { createDatabaseConnection } from "@main/db/connection";
import { agents, requests } from "@main/db/schema";
import { createPolicyEngine } from "@main/engine/policy-engine";
import type { RequestManifest } from "@shared/types";

type ManifestOverrides = {
  who?: Partial<RequestManifest["who"]>;
  what?: Partial<RequestManifest["what"]>;
  where?: Partial<RequestManifest["where"]>;
  why?: Partial<RequestManifest["why"]>;
  risk?: Partial<RequestManifest["risk"]>;
  decision?: Partial<RequestManifest["decision"]>;
};

function buildManifest(overrides: ManifestOverrides = {}): RequestManifest {
  return {
    who: {
      agentId: "agent-1",
      agentName: "claude-code",
      processName: "claude",
      pid: 1111,
      ...overrides.who,
    },
    what: {
      method: "POST",
      url: "https://api.openai.com/v1/chat/completions",
      domain: "api.openai.com",
      bodySize: 128,
      bodyHash: "bodyhash",
      contentType: "application/json",
      dataClassification: "internal",
      ...overrides.what,
    },
    where: {
      domain: "api.openai.com",
      port: 443,
      domainStatus: "allowed",
      isFirstContact: false,
      ...overrides.where,
    },
    why: {
      secretsDetected: [],
      policyViolations: [],
      anomalies: [],
      ...overrides.why,
    },
    risk: {
      threatScore: 12,
      factors: [],
      ...overrides.risk,
    },
    decision: {
      action: "allow",
      reason: "Pending evaluation",
      timestamp: Date.now(),
      receiptHash: "",
      ...overrides.decision,
    },
  };
}

describe("policy engine, audit chain, and database", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rashomon-policy-"));
    fs.mkdirSync(path.join(tempDir, "policies"));
    fs.copyFileSync(
      path.join(process.cwd(), "policies/default.yaml"),
      path.join(tempDir, "policies/default.yaml"),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("evaluates domain rules, secret rules, rate limits, and policy priority merging", async () => {
    fs.writeFileSync(
      path.join(tempDir, "policies/override.yaml"),
      `
version: "1.0"
name: "Priority Override"
priority: 10
global:
  default_action: "allow"
  log_all_requests: true
  intent_analysis: false
  max_request_body_bytes: 4096
  new_domain_action: "block"
domains:
  allowed: []
  denied:
    - "evil.example.com"
  require_approval: []
secrets:
  enabled: true
  action: "block"
  patterns: []
  entropy_detection:
    enabled: true
    min_length: 20
    min_entropy: 4.5
    action: "alert"
sensitive_files:
  enabled: true
  action: "alert"
  paths: []
rate_limits:
  enabled: true
  per_agent:
    requests_per_minute: 5
    requests_per_hour: 10
    max_concurrent: 2
  per_domain:
    requests_per_minute: 2
    requests_per_hour: 4
agents:
  profiles: []
  unknown_agent:
    action: "require_approval"
    max_body_bytes: 256
      `.trim(),
    );

    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    await engine.loadPolicies();

    const blockedDomainDecision = await engine.evaluateRequest(
      buildManifest({
        what: { domain: "evil.example.com", url: "https://evil.example.com/upload" },
        where: { domain: "evil.example.com", isFirstContact: true, domainStatus: "unknown" },
      }),
    );
    expect(blockedDomainDecision.action).toBe("block");

    const secretDecision = await engine.evaluateRequest(
      buildManifest({
        why: {
          secretsDetected: [
            {
              type: "AWS Access Key",
              detector: "pattern",
              redactedMatch: "AKIA...CDEF",
              location: "body",
              start: 0,
              end: 20,
              confidence: 0.99,
              encoding: "plain",
            },
          ],
          policyViolations: [],
          anomalies: [],
        },
      }),
    );
    expect(secretDecision.action).toBe("block");

    const rateLimitedDecision = await engine.evaluateRequest(
      buildManifest({
        why: {
          secretsDetected: [],
          policyViolations: [
            {
              ruleId: "rate-limit-test",
              category: "rate_limit",
              message: "Agent exceeded the rate limit.",
              severity: "high",
            },
          ],
          anomalies: [],
        },
      }),
    );
    expect(rateLimitedDecision.action).toBe("throttle");

    const firstContactDecision = await engine.evaluateRequest(
      buildManifest({
        what: { domain: "new.example.com", url: "https://new.example.com/api" },
        where: { domain: "new.example.com", isFirstContact: true, domainStatus: "unknown" },
      }),
    );
    expect(firstContactDecision.action).toBe("block");
    expect(engine.getMergedPolicy().global.max_request_body_bytes).toBe(4096);
  });

  it("validates policy syntax", () => {
    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    const validation = engine.validatePolicy("name: Broken");
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it("writes tamper-evident audit entries, generates receipts, and supports database CRUD", async () => {
    const services = createDatabaseConnection({ dataDir: path.join(tempDir, "data") });
    const logger = createAuditLogger(services);
    const receipts = createReceiptService(services);

    services.db.insert(agents).values({
      id: "agent-1",
      name: "claude-code",
      processName: "claude",
      pid: 999,
      declaredPurpose: "Ship code safely",
      firstSeen: new Date(),
      lastSeen: new Date(),
      status: "active",
      totalRequests: 0,
      blockedRequests: 0,
      threatScore: 0,
    }).run();

    await logger.logEvent("system_started", { boot: true });
    await logger.logEvent("agent_detected", { name: "claude-code" }, { agentId: "agent-1" });

    const chain = await logger.verifyChain();
    expect(chain.valid).toBe(true);
    expect(chain.totalEntries).toBe(2);

    const requestHash = crypto.createHash("sha256").update("payload").digest("hex");
    const receipt = await receipts.generateDecisionReceipt({
      requestId: "request-1",
      requestHash,
      decision: "block",
      reason: "Secret detected",
      policyRuleId: "secret:detected",
      timestamp: 123456,
    });

    services.db.insert(requests).values({
      id: "request-1",
      agentId: "agent-1",
      timestamp: new Date(),
      method: "POST",
      url: "https://evil.example.com/upload",
      domain: "evil.example.com",
      port: 443,
      requestHeaders: JSON.stringify({ "content-type": "text/plain" }),
      requestBodySize: 7,
      requestBodyHash: requestHash,
      requestBodyPreview: "payload",
      responseStatus: 403,
      responseBodySize: 18,
      decision: "block",
      decisionReason: "Secret detected",
      policyRuleId: "secret:detected",
      threatScore: 95,
      secretsDetected: JSON.stringify(["AWS Access Key"]),
      intentAnalysis: null,
      receiptHash: receipt.chainHash,
    }).run();

    const storedAgent = services.db.select().from(agents).where(eq(agents.id, "agent-1")).get();
    const storedRequest = services.db.select().from(requests).where(eq(requests.id, "request-1")).get();

    expect(storedAgent?.name).toBe("claude-code");
    expect(storedRequest?.receiptHash).toBe(receipt.chainHash);

    services.close();
  });
});
