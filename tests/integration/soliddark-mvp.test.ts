import { mkdtemp, readFile, writeFile, cp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { generateEd25519KeyPair, renderRiskPassportMarkdown, scanProject, sha256Hex } from "../../packages/core/src/index.js";
import { startRegistryServer } from "../../packages/registry/src/index.js";
import { RegistryClient } from "../../packages/sdk/src/index.js";
import { riskPassportSchema } from "../../packages/spec/src/index.js";
import { runCli } from "../../packages/cli/src/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const supportDir = resolve(repoRoot, "tests", "support");

async function makeTempDir(prefix: string) {
  return await mkdtemp(join(tmpdir(), prefix));
}

async function copyFixture(name: string) {
  const source = resolve(repoRoot, "fixtures", name);
  const tempRoot = await makeTempDir(`soliddark-${name}-`);
  const target = join(tempRoot, name);
  await cp(source, target, { recursive: true });
  return target;
}

function withTempHome(homeDir: string) {
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
}

async function captureLogs<T>(fn: () => Promise<T>) {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
  };

  try {
    const result = await fn();
    return { result, lines };
  } finally {
    console.log = original;
  }
}

function normalizeMarkdown(markdown: string) {
  return markdown.replace(/Generated: .+/g, "Generated: <timestamp>");
}

async function listFilesRecursive(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const output: string[] = [];

  for (const entry of entries) {
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listFilesRecursive(root, absolute)));
      continue;
    }

    output.push(absolute.slice(root.length + 1));
  }

  return output.sort();
}

async function withMockedRegistryFetch<T>(
  baseUrl: string,
  handler: (input: string, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (!url.startsWith(baseUrl)) {
      return originalFetch(input as never, init);
    }

    return await handler(url, init);
  };

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe("SolidDark proprietary defensibility MVP", () => {
  it("generates a valid risk passport and deterministic markdown sections", async () => {
    const fixtureDir = await copyFixture("node-simple");
    const { passport } = await scanProject(fixtureDir, { offline: true });
    const parsed = riskPassportSchema.parse(passport);
    const markdown = normalizeMarkdown(renderRiskPassportMarkdown(parsed));

    expect(parsed.summary.dependency_count).toBe(2);
    expect(markdown).toContain("## What we know");
    expect(markdown).toContain("## What we don’t know");
    expect(markdown).toContain("## Next actions");
    expect(markdown).toMatchInlineSnapshot(`
      "# SolidDark Risk Passport

      Generated: <timestamp>
      Tool version: 0.1.0

      ## Disclaimers

      - Not legal advice. For information purposes only.
      - No guarantee of security. This report may be incomplete.

      ## What we know

      - Ecosystems detected: node
      - Dependencies parsed: 2
      - Secret findings: 0
      - Vulnerability findings: UNKNOWN
      - CI detected: yes
      - Tests detected: yes

      ## What we don’t know

      - [repo] Command failed: git rev-parse HEAD
      fatal: not a git repository (or any of the parent directories): .git

      - [vuln-scan] OSV lookup was skipped because offline mode was requested.
      - [secret-scan] gitleaks is not installed; only built-in detectors were used.

      ## Assumptions made

      - [scanner] Supported ecosystems are limited to Node and Python for this MVP.

      ## Contradictions detected

      - No contradictions detected.

      ## Risk score + drivers + confidence

      - Score: 73/100
      - Confidence: 66%
      - Status: UNKNOWN
      - Unknowns penalty: 3 unresolved data points reduce confidence. (-12)
      - No critical findings in local checks: Built-in secret scan did not find secrets and known vulnerabilities were not reported. (0)

      ## Next actions

      1. Run the scan online to resolve vulnerability unknowns. The vulnerability section is unknown without a successful OSV lookup.

      ## Dependency inventory

      - node: lodash@4.17.21 (package-lock.json)
      - node: zod@4.3.6 (package-lock.json)

      "
    `);
  });

  it("runs an offline CLI scan, produces artifacts, and records vulnerability unknowns without failing", async () => {
    const fixtureDir = await copyFixture("node-simple");
    const homeDir = await makeTempDir("soliddark-home-");
    const outDir = await makeTempDir("soliddark-out-");
    withTempHome(homeDir);

    const { lines } = await captureLogs(async () => {
      await runCli(["scan", fixtureDir, "--offline", "--out", outDir], repoRoot);
    });

    const summary = JSON.parse(lines.at(-1) ?? "{}") as { status?: string };
    const passport = riskPassportSchema.parse(JSON.parse(await readFile(join(outDir, "risk-passport.json"), "utf8")));
    const manifest = JSON.parse(await readFile(join(outDir, "scan-manifest.json"), "utf8")) as {
      steps: Array<{ step: string; status: string }>;
    };

    expect(summary.status).toBe("ok");
    expect(passport.vulnerabilities.status).toBe("unknown");
    expect(manifest.steps.some((step) => step.step === "vuln-scan" && step.status === "unknown")).toBe(true);
  });

  it("finds planted secret-like material and contradictory lockfiles", async () => {
    const fixtureDir = await copyFixture("mixed");
    const { passport } = await scanProject(fixtureDir, { offline: true, includePaths: true });

    expect(passport.secrets.findings.some((item) => item.detector === "github-token")).toBe(true);
    expect(passport.contradictions.some((item) => item.message.includes("package-lock.json"))).toBe(true);
  });

  it("maps OSV results back to the correct dependency after filtering versionless entries", async () => {
    const fixtureDir = await makeTempDir("soliddark-osv-");
    await writeFile(join(fixtureDir, "package.json"), `${JSON.stringify({ name: "osv-map", version: "1.0.0" }, null, 2)}\n`, "utf8");
    await writeFile(
      join(fixtureDir, "package-lock.json"),
      `${JSON.stringify({
        name: "osv-map",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: {
          "": { name: "osv-map", version: "1.0.0" },
          "node_modules/versionless-lib": { license: "MIT" },
          "node_modules/real-lib": { version: "2.3.4", license: "MIT" },
        },
      }, null, 2)}\n`,
      "utf8",
    );

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "https://api.osv.dev/v1/querybatch") {
        return new Response(JSON.stringify({
          results: [
            {
              vulns: [
                {
                  id: "OSV-DEMO-1",
                  summary: "Mapped to real-lib",
                },
              ],
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return originalFetch(input as never, init);
    }) as typeof globalThis.fetch;

    try {
      const { passport } = await scanProject(fixtureDir, { offline: false });
      expect(passport.vulnerabilities.findings).toHaveLength(1);
      expect(passport.vulnerabilities.findings[0]?.package).toBe("real-lib");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("signs, publishes, verifies PASS, and fails verification after tampering", async () => {
    const fixtureDir = await copyFixture("node-simple");
    const homeDir = await makeTempDir("soliddark-home-");
    const outDir = await makeTempDir("soliddark-out-");
    const registryDir = await makeTempDir("soliddark-registry-");
    withTempHome(homeDir);

    const server = await startRegistryServer({
      host: "127.0.0.1",
      port: 4011,
      apiKey: "test-key",
      dataDir: registryDir,
      listen: false,
    });

    try {
      const baseUrl = "http://127.0.0.1:4011";
      await withMockedRegistryFetch(
        baseUrl,
        async (url, init) => {
          const pathname = new URL(url).pathname + new URL(url).search;
          const response = await server.app.inject({
            method: (init?.method ?? "GET") as "GET" | "POST",
            url: pathname,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            payload: typeof init?.body === "string" ? init.body : undefined,
          }) as unknown as { body: string; statusCode: number };
          return new Response(response.body, { status: response.statusCode });
        },
        async () => {
          await runCli(["keys", "generate"], repoRoot);
          await runCli(["registry", "login", "--api-key", "test-key", "--url", baseUrl], repoRoot);
          await runCli(["scan", fixtureDir, "--offline", "--out", outDir], repoRoot);

          const passportPath = join(outDir, "risk-passport.json");
          const sigPath = join(outDir, "risk-passport.sig");
          const registryPath = join(outDir, "risk-passport.registry.json");

          const publishRun = await captureLogs(async () => {
            await runCli(["publish", passportPath, "--bench-opt-in"], repoRoot);
          });
          const publishPayload = JSON.parse(publishRun.lines.at(-1) ?? "{}") as {
            verification_tier?: string;
            verification_url?: string;
          };

          expect(publishPayload.verification_tier).toBe("baseline");
          expect(publishPayload.verification_url).toContain("/verify/");

          const passRun = await captureLogs(async () => {
            await runCli(["verify", passportPath, "--sig", sigPath, "--registry-envelope", registryPath], repoRoot);
          });
          const passPayload = JSON.parse(passRun.lines.at(-1) ?? "{}") as {
            overall?: string;
            reasons?: Array<{ message: string }>;
          };

          expect(passPayload.overall).toBe("PASS");
          expect(passPayload.reasons?.some((item) => item.message.includes("Local signature verified"))).toBe(true);

          const tampered = JSON.parse(await readFile(passportPath, "utf8")) as { summary: { dependency_count: number } };
          tampered.summary.dependency_count += 1;
          await writeFile(passportPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");

          const failRun = await captureLogs(async () => {
            await runCli(["verify", passportPath, "--sig", sigPath, "--registry-envelope", registryPath], repoRoot);
          });
          const failPayload = JSON.parse(failRun.lines.at(-1) ?? "{}") as {
            overall?: string;
            reasons?: Array<{ message: string }>;
          };

          expect(failPayload.overall).toBe("FAIL");
          expect(failPayload.reasons?.some((item) => item.message.includes("failed verification"))).toBe(true);
        },
      );
    } finally {
      await server.close();
    }
  });

  it("supports registry revocation and benchmark percentiles", async () => {
    const fixtureDir = await copyFixture("node-simple");
    const homeDir = await makeTempDir("soliddark-home-");
    const outDir = await makeTempDir("soliddark-out-");
    const registryDir = await makeTempDir("soliddark-registry-");
    withTempHome(homeDir);

    const server = await startRegistryServer({
      host: "127.0.0.1",
      port: 4012,
      apiKey: "bench-key",
      dataDir: registryDir,
      listen: false,
    });

    try {
      const baseUrl = "http://127.0.0.1:4012";
      await withMockedRegistryFetch(
        baseUrl,
        async (url, init) => {
          const pathname = new URL(url).pathname + new URL(url).search;
          const response = await server.app.inject({
            method: (init?.method ?? "GET") as "GET" | "POST",
            url: pathname,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            payload: typeof init?.body === "string" ? init.body : undefined,
          }) as unknown as { body: string; statusCode: number };
          return new Response(response.body, { status: response.statusCode });
        },
        async () => {
          const client = new RegistryClient({ baseUrl, apiKey: "bench-key" });

          await runCli(["keys", "generate"], repoRoot);
          await runCli(["registry", "login", "--api-key", "bench-key", "--url", baseUrl], repoRoot);
          await runCli(["scan", fixtureDir, "--offline", "--out", outDir], repoRoot);

          const passportPath = join(outDir, "risk-passport.json");
          await runCli(["publish", passportPath, "--bench-opt-in"], repoRoot);

          const envelope = JSON.parse(await readFile(join(outDir, "risk-passport.registry.json"), "utf8")) as {
            verification_id: string;
          };

          const verifyBefore = await client.verify(envelope.verification_id);
          expect(verifyBefore.status).toBe("valid");
          expect(verifyBefore.verification_tier).toBe("baseline");

          const revokeResult = await client.revoke(envelope.verification_id);
          expect(revokeResult.status).toBe("revoked");

          const percentile = await client.getPercentile({
            ecosystem: "node",
            metric: "dep_count",
            value: 2,
          });
          expect(percentile.dataset_size).toBeGreaterThan(0);
          expect(percentile.percentile).toBeGreaterThanOrEqual(0);
          expect(percentile.percentile).toBeLessThanOrEqual(100);

          const networkStats = await client.getBenchmarkStats();
          expect(networkStats.network_stats.issued_total).toBeGreaterThan(0);
          expect(networkStats.network_stats.benchmark_records_total).toBeGreaterThan(0);
          expect(networkStats.network_stats.tier_counts.baseline).toBeGreaterThan(0);
        },
      );
    } finally {
      await server.close();
    }
  });

  it("renders a buyer-facing verification page without exposing repository contents", async () => {
    const baseUrl = "http://127.0.0.1:4016";
    const registryDir = await makeTempDir("soliddark-registry-");
    const server = await startRegistryServer({
      host: "127.0.0.1",
      port: 4016,
      apiKey: "page-key",
      dataDir: registryDir,
      listen: false,
    });

    try {
      let envelopeId = "UNKNOWN";
      await withMockedRegistryFetch(
        baseUrl,
        async (url, init) => {
          const pathname = new URL(url).pathname + new URL(url).search;
          const response = await server.app.inject({
            method: (init?.method ?? "GET") as "GET" | "POST",
            url: pathname,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            payload: typeof init?.body === "string" ? init.body : undefined,
          }) as unknown as { body: string; statusCode: number; headers: Record<string, string> };
          return new Response(response.body, { status: response.statusCode, headers: response.headers });
        },
        async () => {
          const client = new RegistryClient({ baseUrl, apiKey: "page-key" });
          const envelope = await client.issue({
            passport_hash: "a".repeat(64),
            tool_version: "0.1.0",
            generated_at: new Date().toISOString(),
            ecosystems: ["node"],
            dependency_count: 4,
            vuln_count: 0,
            secret_findings_count: 0,
            unknowns_count: 0,
            project_label: "demo",
          });
          envelopeId = envelope.verification_id;
          await client.ingestBenchmark({
            ecosystem: "node",
            metrics: { dep_count: 4 },
            source: "test",
            generated_at: new Date().toISOString(),
          });
        },
      );

      const response = await server.app.inject({
        method: "GET",
        url: `/verify/${envelopeId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("SolidDark Trust Registry");
      expect(response.body).toContain(envelopeId);
      expect(response.body).toContain("Baseline receipt");
      expect(response.body).not.toContain("node_modules");
    } finally {
      await server.close();
    }
  });

  it("verifies historical envelopes after registry key rotation", async () => {
    const fixtureDir = await copyFixture("node-simple");
    const homeDir = await makeTempDir("soliddark-home-");
    const outDir = await makeTempDir("soliddark-out-");
    const registryDir = await makeTempDir("soliddark-registry-");
    withTempHome(homeDir);

    const baseUrl = "http://127.0.0.1:4015";
    const server = await startRegistryServer({
      host: "127.0.0.1",
      port: 4015,
      apiKey: "rotate-key",
      dataDir: registryDir,
      listen: false,
    });

    try {
      await withMockedRegistryFetch(
        baseUrl,
        async (url, init) => {
          const pathname = new URL(url).pathname + new URL(url).search;
          const response = await server.app.inject({
            method: (init?.method ?? "GET") as "GET" | "POST",
            url: pathname,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            payload: typeof init?.body === "string" ? init.body : undefined,
          }) as unknown as { body: string; statusCode: number };
          return new Response(response.body, { status: response.statusCode });
        },
        async () => {
          await runCli(["keys", "generate"], repoRoot);
          await runCli(["registry", "login", "--api-key", "rotate-key", "--url", baseUrl], repoRoot);
          await runCli(["scan", fixtureDir, "--offline", "--out", outDir], repoRoot);
          await runCli(["publish", join(outDir, "risk-passport.json")], repoRoot);
        },
      );
    } finally {
      await server.close();
    }

    const rotatedPair = generateEd25519KeyPair();
    await writeFile(
      join(registryDir, "registry-keypair.json"),
      `${JSON.stringify({
        ...rotatedPair,
        publicKeyId: sha256Hex(rotatedPair.publicKey).slice(0, 12),
      }, null, 2)}\n`,
      "utf8",
    );

    const rotatedServer = await startRegistryServer({
      host: "127.0.0.1",
      port: 4015,
      apiKey: "rotate-key",
      dataDir: registryDir,
      listen: false,
    });

    try {
      await withMockedRegistryFetch(
        baseUrl,
        async (url, init) => {
          const pathname = new URL(url).pathname + new URL(url).search;
          const response = await rotatedServer.app.inject({
            method: (init?.method ?? "GET") as "GET" | "POST",
            url: pathname,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            payload: typeof init?.body === "string" ? init.body : undefined,
          }) as unknown as { body: string; statusCode: number };
          return new Response(response.body, { status: response.statusCode });
        },
        async () => {
          const passRun = await captureLogs(async () => {
            await runCli([
              "verify",
              join(outDir, "risk-passport.json"),
              "--sig",
              join(outDir, "risk-passport.sig"),
              "--registry-envelope",
              join(outDir, "risk-passport.registry.json"),
            ], repoRoot);
          });
          const payload = JSON.parse(passRun.lines.at(-1) ?? "{}") as { overall?: string };
          expect(payload.overall).toBe("PASS");
        },
      );
    } finally {
      await rotatedServer.close();
    }
  });

  it("refuses to start the registry without an explicit API key", async () => {
    const previousApiKey = process.env.SOLIDDARK_REGISTRY_API_KEY;
    delete process.env.SOLIDDARK_REGISTRY_API_KEY;

    try {
      await expect(startRegistryServer({
        host: "127.0.0.1",
        port: 4020,
        listen: false,
      })).rejects.toThrow(/SOLIDDARK_REGISTRY_API_KEY is required/i);
    } finally {
      if (previousApiKey) {
        process.env.SOLIDDARK_REGISTRY_API_KEY = previousApiKey;
      }
    }
  });

  it("loads a private core overlay when configured", async () => {
    const fixtureDir = await copyFixture("node-simple");
    process.env.SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE = join(supportDir, "private-core-hooks.mjs");

    try {
      const { passport, manifest } = await scanProject(fixtureDir, {
        offline: true,
        registryClient: {
          async getPercentile() {
            return { percentile: 82, dataset_size: 11 };
          },
        },
      });

      expect(passport.risk_score.drivers.some((driver) => driver.label === "Private trust weighting")).toBe(true);
      expect(passport.next_actions[0]?.action).toContain("managed SolidDark review");
      expect(passport.enrichment.status).toBe("ok");
      expect(manifest.steps.some((step) => step.step === "private-risk-overlay" && step.status === "ok")).toBe(true);
    } finally {
      delete process.env.SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE;
    }
  });

  it("blocks registry issuance when a private policy denies it", async () => {
    const fixtureDir = await copyFixture("node-simple");
    const homeDir = await makeTempDir("soliddark-home-");
    const outDir = await makeTempDir("soliddark-out-");
    const registryDir = await makeTempDir("soliddark-registry-");
    withTempHome(homeDir);
    process.env.SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE = join(supportDir, "private-registry-policy.mjs");

    const server = await startRegistryServer({
      host: "127.0.0.1",
      port: 4014,
      apiKey: "deny-key",
      dataDir: registryDir,
      listen: false,
    });

    try {
      const baseUrl = "http://127.0.0.1:4014";
      await withMockedRegistryFetch(
        baseUrl,
        async (url, init) => {
          const pathname = new URL(url).pathname + new URL(url).search;
          const response = await server.app.inject({
            method: (init?.method ?? "GET") as "GET" | "POST",
            url: pathname,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            payload: typeof init?.body === "string" ? init.body : undefined,
          }) as unknown as { body: string; statusCode: number };
          return new Response(response.body, { status: response.statusCode });
        },
        async () => {
          await runCli(["keys", "generate"], repoRoot);
          await runCli(["registry", "login", "--api-key", "deny-key", "--url", baseUrl], repoRoot);
          await runCli(["scan", fixtureDir, "--offline", "--out", outDir], repoRoot);

          await expect(runCli(["publish", join(outDir, "risk-passport.json")], repoRoot)).rejects.toThrow(/Issuance denied by policy/i);
        },
      );
    } finally {
      delete process.env.SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE;
      await server.close();
    }
  });

  it("allows private policy modules to elevate issuance tier", async () => {
    const baseUrl = "http://127.0.0.1:4017";
    const registryDir = await makeTempDir("soliddark-registry-");
    process.env.SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE = join(supportDir, "private-registry-policy.mjs");

    const server = await startRegistryServer({
      host: "127.0.0.1",
      port: 4017,
      apiKey: "tier-key",
      dataDir: registryDir,
      listen: false,
    });

    try {
      await withMockedRegistryFetch(
        baseUrl,
        async (url, init) => {
          const pathname = new URL(url).pathname + new URL(url).search;
          const response = await server.app.inject({
            method: (init?.method ?? "GET") as "GET" | "POST",
            url: pathname,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            payload: typeof init?.body === "string" ? init.body : undefined,
          }) as unknown as { body: string; statusCode: number; headers: Record<string, string> };
          return new Response(response.body, { status: response.statusCode, headers: response.headers });
        },
        async () => {
          const client = new RegistryClient({ baseUrl, apiKey: "tier-key" });
          const envelope = await client.issue({
            passport_hash: "b".repeat(64),
            tool_version: "0.1.0",
            generated_at: new Date().toISOString(),
            ecosystems: ["node"],
            dependency_count: 1,
            vuln_count: 0,
            secret_findings_count: 0,
            unknowns_count: 1,
            project_label: "managed-review",
          });
          const verification = await client.verify(envelope.verification_id);

          expect(envelope.verification_tier).toBe("verified");
          expect(verification.verification_tier).toBe("verified");
        },
      );
    } finally {
      delete process.env.SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE;
      await server.close();
    }
  });

  it("exports a vendor packet with procurement-ready files", async () => {
    const fixtureDir = await copyFixture("node-simple");
    const homeDir = await makeTempDir("soliddark-home-");
    const outDir = await makeTempDir("soliddark-out-");
    const exportDir = await makeTempDir("soliddark-export-");
    withTempHome(homeDir);

    await runCli(["keys", "generate"], repoRoot);
    await runCli(["scan", fixtureDir, "--offline", "--out", outDir], repoRoot);
    await runCli(["continuity", fixtureDir, "--out", outDir], repoRoot);
    await runCli([
      "export",
      "vendor-packet",
      "--passport",
      join(outDir, "risk-passport.json"),
      "--continuity",
      join(outDir, "continuity-pack"),
      "--out",
      exportDir,
    ], repoRoot);

    const files = await listFilesRecursive(exportDir);
    expect(files).toEqual([
      "continuity-pack/README.md",
      "continuity-pack/credential-handoff.md",
      "continuity-pack/incident-contacts.md",
      "continuity-pack/inference-hints.json",
      "continuity-pack/release-checklist.md",
      "disclaimers.txt",
      "executive-summary.md",
      "risk-passport.json",
      "risk-passport.md",
      "verification.txt",
    ]);
  });
});
