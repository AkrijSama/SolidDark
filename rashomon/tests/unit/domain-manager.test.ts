import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "@main/db/connection";
import { createDomainManager } from "@main/engine/domain-manager";
import { createPolicyEngine } from "@main/engine/policy-engine";

describe("domain manager", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rashomon-domains-"));
    fs.mkdirSync(path.join(tempDir, "policies"));
    fs.copyFileSync(
      path.join(process.cwd(), "policies/default.yaml"),
      path.join(tempDir, "policies/default.yaml"),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("matches glob patterns and tracks first-contact domains", async () => {
    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    await engine.loadPolicies();
    const services = createDatabaseConnection({ dataDir: path.join(tempDir, "data") });
    const manager = createDomainManager(services, engine);

    const first = await manager.checkDomain("api.github.com");
    expect(first.status).toBe("allowed");
    expect(first.isFirstContact).toBe(true);

    const approval = await manager.checkDomain("demo.webhook.site");
    expect(approval.status).toBe("pending_approval");

    await manager.recordDomainContact("api.github.com");
    const second = await manager.checkDomain("api.github.com");
    expect(second.isFirstContact).toBe(false);

    await manager.recordDomainContact("unknown.example.com");
    const unknown = await manager.getUnknownDomains();
    expect(unknown.map((entry) => entry.domain)).toContain("unknown.example.com");

    await manager.approveDomain("unknown.example.com");
    const stats = await manager.getDomainStats();
    expect(stats.find((entry) => entry.domain === "unknown.example.com")?.status).toBe("allowed");

    services.close();
  });
});
