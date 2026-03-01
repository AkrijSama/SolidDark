import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { BrowserWindow, ipcMain } from "electron";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { type DatabaseServices } from "../db/connection";
import { agents, auditLog, policies, requests } from "../db/schema";
import { type DomainManager } from "../engine/domain-manager";
import { type IntentAnalyzer } from "../engine/intent-analyzer";
import { type PolicyEngine } from "../engine/policy-engine";
import { type AgentDetector } from "../proxy/agent-detector";
import { type ProxyServerController } from "../proxy/server";
import { getCAPath } from "../proxy/tls";
import type {
  IpcResponse,
  SettingsState,
  TrafficEvent,
} from "../../shared/types";

interface IpcContext {
  mainWindow: BrowserWindow;
  database: DatabaseServices;
  policyEngine: PolicyEngine;
  domainManager: DomainManager;
  proxyServer: ProxyServerController;
  agentDetector: AgentDetector;
  intentAnalyzer: IntentAnalyzer;
  getSettings: () => SettingsState;
  updateSettings: (nextSettings: Partial<SettingsState>) => SettingsState;
  onTraffic: (listener: (event: TrafficEvent) => void) => () => void;
}

function ok<T>(data: T): IpcResponse<T> {
  return { ok: true, data };
}

function fail(error: unknown): IpcResponse<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Unknown IPC error.",
  };
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? "";
  if (!senderUrl.startsWith("file://") && !senderUrl.startsWith("http://127.0.0.1:9090")) {
    throw new Error(`Rejected IPC call from untrusted origin: ${senderUrl}`);
  }
}

function countRules(yamlContent: string): number {
  return yamlContent.split("\n").filter((line) => line.trim().startsWith("- ")).length;
}

export function setupIpcHandlers(context: IpcContext): () => void {
  const {
    mainWindow,
    database,
    policyEngine,
    domainManager,
    proxyServer,
    agentDetector,
    intentAnalyzer,
    getSettings,
    updateSettings,
    onTraffic,
  } = context;

  const unsubscribeTraffic = onTraffic((event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("traffic:stream", event);
    }
  });

  const listeners: Array<() => void> = [];

  function registerHandle(channel: string, handler: (event: Electron.IpcMainInvokeEvent, payload: any) => Promise<unknown>) {
    ipcMain.handle(channel, async (event, payload) => {
      assertTrustedSender(event);
      try {
        return ok(await handler(event, payload));
      } catch (error) {
        return fail(error);
      }
    });
    listeners.push(() => {
      ipcMain.removeHandler(channel);
    });
  }

  registerHandle("agents:list", async () => {
    const liveAgents = await agentDetector.detectAgents();
    const storedAgents = database.db.select().from(agents).all();

    return liveAgents.map((liveAgent) => {
      const stored = storedAgents.find((entry) => entry.pid === liveAgent.pid || entry.id === liveAgent.id);
      return {
        ...liveAgent,
        ...stored,
        totalRequests: stored?.totalRequests ?? 0,
        blockedRequests: stored?.blockedRequests ?? 0,
        threatScore: stored?.threatScore ?? 0,
      };
    });
  });

  registerHandle("agents:kill", async (_event, agentId: string) => {
    database.db.update(agents).set({ status: "killed", lastSeen: new Date() }).where(eq(agents.id, agentId)).run();
    return true;
  });

  registerHandle("agents:resume", async (_event, agentId: string) => {
    database.db.update(agents).set({ status: "active", lastSeen: new Date() }).where(eq(agents.id, agentId)).run();
    return true;
  });

  registerHandle("policies:list", async () => {
    await policyEngine.loadPolicies();
    return policyEngine.getPolicies().map((policy) => ({
      id: policy.id,
      name: policy.policy.name,
      description: policy.policy.name,
      yamlContent: policy.content,
      enabled: policy.enabled,
      priority: policy.priority,
      ruleCount: countRules(policy.content),
      filePath: policy.filePath,
    }));
  });

  registerHandle("policies:create", async (_event, payload: { name: string; yamlContent: string; priority?: number }) => {
    const validation = policyEngine.validatePolicy(payload.yamlContent);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    const filePath = path.join(policyEngine.getPoliciesDir(), `${payload.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.yaml`);
    fs.writeFileSync(filePath, payload.yamlContent);
    database.db.insert(policies).values({
      id: crypto.randomUUID(),
      name: payload.name,
      description: null,
      yamlContent: payload.yamlContent,
      enabled: true,
      priority: payload.priority ?? 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    await policyEngine.reloadPolicies();
    return true;
  });

  registerHandle("policies:update", async (_event, payload: { id: string; yamlContent: string }) => {
    const validation = policyEngine.validatePolicy(payload.yamlContent);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    const existing = database.db.select().from(policies).where(eq(policies.id, payload.id)).get();
    if (!existing) {
      throw new Error(`Unknown policy ${payload.id}`);
    }

    const filePath = policyEngine
      .getPolicies()
      .find((policy) => policy.policy.name === existing.name)?.filePath;
    if (!filePath) {
      throw new Error(`Could not locate file for policy ${existing.name}`);
    }

    fs.writeFileSync(filePath, payload.yamlContent);
    database.db.update(policies).set({
      yamlContent: payload.yamlContent,
      updatedAt: new Date(),
    }).where(eq(policies.id, payload.id)).run();

    await policyEngine.reloadPolicies();
    return true;
  });

  registerHandle("policies:delete", async (_event, policyId: string) => {
    const existing = database.db.select().from(policies).where(eq(policies.id, policyId)).get();
    if (!existing) {
      return true;
    }

    const filePath = policyEngine
      .getPolicies()
      .find((policy) => policy.policy.name === existing.name)?.filePath;

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    database.db.delete(policies).where(eq(policies.id, policyId)).run();
    await policyEngine.reloadPolicies();
    return true;
  });

  registerHandle("domains:list", async () => domainManager.getDomainStats());
  registerHandle("domains:approve", async (_event, domain: string) => domainManager.approveDomain(domain));
  registerHandle("domains:deny", async (_event, domain: string) => domainManager.denyDomain(domain));

  registerHandle(
    "audit:query",
    async (
      _event,
      payload: {
        limit?: number;
        eventType?: string;
        agentId?: string;
        decision?: string;
        dateFrom?: number;
        dateTo?: number;
      } = {},
    ) => {
      const conditions = [];

      if (payload.eventType) {
        conditions.push(eq(auditLog.eventType, payload.eventType as never));
      }
      if (payload.agentId) {
        conditions.push(eq(auditLog.agentId, payload.agentId));
      }
      if (payload.dateFrom) {
        conditions.push(gte(auditLog.timestamp, new Date(payload.dateFrom)));
      }
      if (payload.dateTo) {
        conditions.push(lte(auditLog.timestamp, new Date(payload.dateTo)));
      }

      let query = database.db.select().from(auditLog).orderBy(desc(auditLog.timestamp));
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      return query.limit(payload.limit ?? 100).all();
    },
  );

  registerHandle("requests:detail", async (_event, requestId: string) => {
    return database.db.select().from(requests).where(eq(requests.id, requestId)).get();
  });

  registerHandle("settings:get", async () => ({
    ...getSettings(),
    caPath: getCAPath(),
    proxyRunning: proxyServer.isRunning(),
    proxyPaused: proxyServer.isPaused(),
  }));

  registerHandle("settings:update", async (_event, payload: Partial<SettingsState>) => {
    const next = updateSettings(payload);
    intentAnalyzer.updateConfig({
      provider: next.intentProvider,
      anthropicApiKey: next.anthropicApiKey,
      ollamaBaseUrl: next.ollamaBaseUrl,
      model: next.intentModel,
      threshold: next.intentThreshold,
    });
    return next;
  });

  registerHandle("stats:summary", async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [requestsToday, blockedToday, activeAgents] = await Promise.all([
      Promise.resolve(
        database.db
          .select({ count: sql<number>`count(*)` })
          .from(requests)
          .where(gte(requests.timestamp, todayStart))
          .get()?.count ?? 0,
      ),
      Promise.resolve(
        database.db
          .select({ count: sql<number>`count(*)` })
          .from(requests)
          .where(and(gte(requests.timestamp, todayStart), sql`${requests.decision} != 'allow'`))
          .get()?.count ?? 0,
      ),
      Promise.resolve(
        database.db
          .select({ count: sql<number>`count(*)` })
          .from(agents)
          .where(eq(agents.status, "active"))
          .get()?.count ?? 0,
      ),
    ]);

    const maxThreat = database.db
      .select({ maxThreat: sql<number>`coalesce(max(${requests.threatScore}), 0)` })
      .from(requests)
      .get()?.maxThreat ?? 0;

    return {
      requestsToday,
      blockedToday,
      activeAgents,
      threatLevel: maxThreat,
    };
  });

  return () => {
    unsubscribeTraffic();
    for (const cleanup of listeners) {
      cleanup();
    }
  };
}
