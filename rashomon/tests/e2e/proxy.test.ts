import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test, expect } from "@playwright/test";

import { createDatabaseConnection } from "@main/db/connection";
import { createDomainManager } from "@main/engine/domain-manager";
import { createIntentAnalyzer } from "@main/engine/intent-analyzer";
import { createPolicyEngine } from "@main/engine/policy-engine";
import { createRateLimiter } from "@main/engine/rate-limiter";
import { createSecretScanner } from "@main/engine/secret-scanner";
import type { AgentDetector } from "@main/proxy/agent-detector";
import { createRequestInterceptor } from "@main/proxy/interceptor";
test("proxy interception allows safe requests and throttles repeated traffic", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rashomon-proxy-"));
  const policiesDir = path.join(tempDir, "policies");
  fs.mkdirSync(policiesDir, { recursive: true });
  fs.writeFileSync(
    path.join(policiesDir, "default.yaml"),
    `
version: "1.0"
name: "Proxy Test Policy"
priority: 1
global:
  default_action: "allow"
  log_all_requests: true
  intent_analysis: false
  max_request_body_bytes: 10485760
  new_domain_action: "allow"
domains:
  allowed:
    - "127.0.0.1"
  denied: []
  require_approval: []
secrets:
  enabled: true
  action: "block"
  patterns: []
  entropy_detection:
    enabled: false
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
    requests_per_minute: 20
    requests_per_hour: 20
    max_concurrent: 1
  per_domain:
    requests_per_minute: 20
    requests_per_hour: 20
agents:
  profiles: []
  unknown_agent:
    action: "allow"
    max_body_bytes: 10485760
    `.trim(),
  );

  const database = createDatabaseConnection({ dataDir: path.join(tempDir, "data") });
  const policyEngine = createPolicyEngine({ policiesDir });
  await policyEngine.loadPolicies();
  const detector: AgentDetector = {
    detectAgents: async () => [],
    getAgentForPid: async (pid: number) => ({
      id: `agent-${pid}`,
      name: "proxy-e2e",
      processName: "proxy-e2e",
      processPath: "/usr/bin/proxy-e2e",
      pid,
      declaredPurpose: null,
      status: "active" as const,
      matchedProfile: null,
      allowedDomainsExtra: [],
      maxBodyBytes: 10_485_760,
      detectedAt: Date.now(),
    }),
    getProcessForConnection: async (sourcePort: number) => ({
      pid: 7788,
      name: "proxy-e2e",
      path: "/usr/bin/proxy-e2e",
      sourcePort,
      resolvedAt: Date.now(),
    }),
    watchProcesses: () => ({ stop: () => undefined }),
  };
  const interceptor = createRequestInterceptor(
    database,
    policyEngine,
    createDomainManager(database, policyEngine),
    createRateLimiter(policyEngine),
    createSecretScanner(policyEngine),
    createIntentAnalyzer({ provider: "disabled" }),
    detector,
  );

  const first = await interceptor.intercept({
    method: "GET",
    url: "http://127.0.0.1/resource",
    headers: {
      host: "127.0.0.1",
    },
    body: "",
    protocol: "http",
    sourcePort: 49152,
  });

  expect(first.action).toBe("allow");
  expect(first.statusCode).toBe(200);

  const second = await interceptor.intercept({
    method: "GET",
    url: "http://127.0.0.1/resource",
    headers: {
      host: "127.0.0.1",
    },
    body: "",
    protocol: "http",
    sourcePort: 49152,
  });
  expect(second.action).toBe("throttle");
});
