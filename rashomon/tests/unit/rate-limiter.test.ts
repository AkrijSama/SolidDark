import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPolicyEngine } from "@main/engine/policy-engine";
import { createRateLimiter } from "@main/engine/rate-limiter";

describe("rate limiter", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rashomon-rate-"));
    fs.mkdirSync(path.join(tempDir, "policies"));
    fs.writeFileSync(
      path.join(tempDir, "policies/limits.yaml"),
      `
version: "1.0"
name: "Tight Limits"
priority: 1
global:
  default_action: "allow"
  log_all_requests: true
  intent_analysis: false
  max_request_body_bytes: 10485760
  new_domain_action: "require_approval"
domains:
  allowed: []
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
    requests_per_minute: 2
    requests_per_hour: 4
    max_concurrent: 1
  per_domain:
    requests_per_minute: 1
    requests_per_hour: 3
agents:
  profiles: []
  unknown_agent:
    action: "require_approval"
    max_body_bytes: 100
      `.trim(),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("enforces per-agent and per-domain limits and reports usage", async () => {
    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    await engine.loadPolicies();
    const limiter = createRateLimiter(engine);

    const first = await limiter.checkLimit("agent-1", "api.example.com");
    expect(first.allowed).toBe(true);

    const second = await limiter.checkLimit("agent-1", "api.example.com");
    expect(second.allowed).toBe(false);
    expect(second.exceededKey).toBe("agent:agent-1:concurrent");

    limiter.complete("agent-1", "api.example.com");

    const third = await limiter.checkLimit("agent-1", "api.example.com");
    expect(third.allowed).toBe(false);
    expect(third.exceededKey).toBe("domain:api.example.com:minute");

    const usage = limiter.getUsage("agent-1");
    expect(usage.requestsLastMinute).toBeGreaterThanOrEqual(1);
  });
});
