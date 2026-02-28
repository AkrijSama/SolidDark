import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

import Fastify from "fastify";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import {
  canonicalizeJson,
  generateEd25519KeyPair,
  REGISTRY_ISSUER,
  sha256Hex,
  signCanonicalJson,
  verifyCanonicalJson,
} from "@soliddark/core";
import {
  benchmarkIngestSchema,
  type RegistryEnvelope,
  type RegistryPublishPayload,
  type RegistryVerifyResponse,
  type VerificationTier,
  registryEnvelopeSchema,
  registryPublishPayloadSchema,
  registryVerifyResponseSchema,
} from "@soliddark/spec";

import { loadRegistryIssuancePolicy } from "./policy.js";

const require = createRequire(import.meta.url);

type RegistryOptions = {
  host?: string;
  port?: number;
  dataDir?: string;
  apiKey?: string;
  listen?: boolean;
};

type RegistryKeyRecord = {
  publicKey: string;
  secretKey: string;
  publicKeyId: string;
};

type StoredRegistryKey = {
  pubkey_id: string;
  public_key: string;
  created_at: string;
};

type StoredIssuance = {
  verification_id: string;
  passport_hash: string;
  issued_at: string;
  issuer: string;
  registry_pubkey_id: string;
  verification_tier: VerificationTier;
  signature: string;
  revoked_at: string | null;
  policy_notes_json: string;
};

function resolveDataDir(options?: RegistryOptions) {
  return resolve(options?.dataDir ?? join(process.cwd(), "packages/registry/data"));
}

function loadOrCreateKeyRecord(dataDir: string): RegistryKeyRecord {
  mkdirSync(dataDir, { recursive: true });
  const envPublicKey = process.env.SOLIDDARK_REGISTRY_PUBLIC_KEY;
  const envSecretKey = process.env.SOLIDDARK_REGISTRY_SECRET_KEY;
  const keyPath = join(dataDir, "registry-keypair.json");

  if (envPublicKey && envSecretKey) {
    return {
      publicKey: envPublicKey,
      secretKey: envSecretKey,
      publicKeyId: sha256Hex(envPublicKey).slice(0, 12),
    };
  }

  if (existsSync(keyPath)) {
    return JSON.parse(readFileSync(keyPath, "utf8")) as RegistryKeyRecord;
  }

  const pair = generateEd25519KeyPair();
  const record: RegistryKeyRecord = {
    ...pair,
    publicKeyId: sha256Hex(pair.publicKey).slice(0, 12),
  };
  writeFileSync(keyPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

async function loadDatabase(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = (await initSqlJs({
    locateFile() {
      return wasmPath;
    },
  })) as SqlJsStatic;
  const dbPath = join(dataDir, "registry.sqlite");
  const db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS registry_keys (
      pubkey_id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS issuances (
      verification_id TEXT PRIMARY KEY,
      passport_hash TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      issuer TEXT NOT NULL,
      registry_pubkey_id TEXT NOT NULL,
      verification_tier TEXT NOT NULL DEFAULT 'baseline',
      signature TEXT NOT NULL,
      tool_version TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      ecosystems_json TEXT NOT NULL,
      dependency_count INTEGER NOT NULL,
      vuln_count INTEGER,
      secret_findings_count INTEGER NOT NULL,
      unknowns_count INTEGER NOT NULL,
      project_label TEXT,
      policy_notes_json TEXT NOT NULL DEFAULT '[]',
      revoked_at TEXT
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bench_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecosystem TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      source TEXT NOT NULL,
      generated_at TEXT NOT NULL
    );
  `);

  const issuanceColumns = new Set(
    (db.exec("PRAGMA table_info(issuances)")[0]?.values ?? []).map((row) => String(row[1])),
  );
  if (!issuanceColumns.has("verification_tier")) {
    db.run(`ALTER TABLE issuances ADD COLUMN verification_tier TEXT NOT NULL DEFAULT 'baseline'`);
  }
  if (!issuanceColumns.has("policy_notes_json")) {
    db.run(`ALTER TABLE issuances ADD COLUMN policy_notes_json TEXT NOT NULL DEFAULT '[]'`);
  }

  function persist() {
    writeFileSync(dbPath, Buffer.from(db.export()));
  }

  return { db, persist, dbPath };
}

function randomVerificationId() {
  return randomBytes(18).toString("base64url");
}

function authenticate(request: { headers: Record<string, unknown> }, apiKey: string) {
  const header = typeof request.headers.authorization === "string" ? request.headers.authorization : "";
  return header === `Bearer ${apiKey}`;
}

function getSingleRow(db: Database, query: string, params: unknown[] = []) {
  const result = db.exec(query, params)[0];
  if (!result || !result.values[0]) {
    return null;
  }

  return Object.fromEntries(
    result.columns.map((column: string, index: number) => [column, result.values[0]?.[index] ?? null]),
  );
}

function saveRegistryKey(db: Database, keyRecord: RegistryKeyRecord) {
  db.run(
    `INSERT OR IGNORE INTO registry_keys (pubkey_id, public_key, created_at) VALUES (?, ?, ?)`,
    [keyRecord.publicKeyId, keyRecord.publicKey, new Date().toISOString()],
  );
}

function getRegistryKey(db: Database, pubkeyId: string): StoredRegistryKey | null {
  return getSingleRow(
    db,
    `SELECT pubkey_id, public_key, created_at FROM registry_keys WHERE pubkey_id = ?`,
    [pubkeyId],
  ) as StoredRegistryKey | null;
}

function getIssuance(db: Database, verificationId: string): StoredIssuance | null {
  return getSingleRow(
    db,
    `SELECT verification_id, passport_hash, issued_at, issuer, registry_pubkey_id, verification_tier, signature, revoked_at, policy_notes_json
     FROM issuances WHERE verification_id = ?`,
    [verificationId],
  ) as StoredIssuance | null;
}

function countValue(db: Database, query: string, params: unknown[] = []) {
  const row = getSingleRow(db, query, params);
  if (!row) {
    return 0;
  }

  const value = row[Object.keys(row)[0] ?? ""];
  return Number(value ?? 0);
}

function listStrings(db: Database, query: string, params: unknown[] = []) {
  return (db.exec(query, params)[0]?.values ?? [])
    .map((row) => String(row[0] ?? ""))
    .filter(Boolean);
}

function getNetworkStats(db: Database) {
  const issuedTotal = countValue(db, "SELECT COUNT(*) AS total FROM issuances");
  const revokedTotal = countValue(db, "SELECT COUNT(*) AS total FROM issuances WHERE revoked_at IS NOT NULL");
  const benchmarkRecordsTotal = countValue(db, "SELECT COUNT(*) AS total FROM bench_records");
  const benchmarkSourcesTotal = countValue(db, "SELECT COUNT(DISTINCT source) AS total FROM bench_records");
  const latestIssuedAtRow = getSingleRow(db, "SELECT MAX(issued_at) AS latest_issued_at FROM issuances");
  const tierRows = db.exec(
    "SELECT verification_tier, COUNT(*) AS total FROM issuances GROUP BY verification_tier ORDER BY verification_tier ASC",
  )[0]?.values ?? [];
  const tierCounts: Record<VerificationTier, number> = {
    baseline: 0,
    reviewed: 0,
    verified: 0,
  };

  for (const row of tierRows) {
    const tier = String(row[0] ?? "") as VerificationTier;
    if (tier in tierCounts) {
      tierCounts[tier] = Number(row[1] ?? 0);
    }
  }

  return {
    issued_total: issuedTotal,
    active_total: Math.max(issuedTotal - revokedTotal, 0),
    revoked_total: revokedTotal,
    benchmark_records_total: benchmarkRecordsTotal,
    benchmark_sources_total: benchmarkSourcesTotal,
    ecosystems_tracked: listStrings(db, "SELECT DISTINCT ecosystem FROM bench_records ORDER BY ecosystem ASC"),
    latest_issued_at: latestIssuedAtRow?.latest_issued_at ? String(latestIssuedAtRow.latest_issued_at) : null,
    tier_counts: tierCounts,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function tierLabel(tier: VerificationTier) {
  switch (tier) {
    case "verified":
      return "SolidDark Verified";
    case "reviewed":
      return "SolidDark Reviewed";
    default:
      return "Baseline receipt";
  }
}

function renderVerificationPage(input: {
  verificationId: string;
  verification: RegistryVerifyResponse;
  policyNotes: string[];
  networkStats: ReturnType<typeof getNetworkStats>;
  verificationUrl: string;
}) {
  const statusTone =
    input.verification.status === "valid" && input.verification.signature_valid
      ? "#1f7a42"
      : input.verification.status === "revoked"
        ? "#8a2f2f"
        : "#8a5a11";
  const statusLabel =
    input.verification.status === "valid" && input.verification.signature_valid
      ? "Valid"
      : input.verification.status === "revoked"
        ? "Revoked"
        : "Unknown";
  const notes = input.policyNotes.length > 0 ? input.policyNotes : ["No additional issuance notes were recorded."];
  const ecosystems =
    input.networkStats.ecosystems_tracked.length > 0 ? input.networkStats.ecosystems_tracked.join(", ") : "UNKNOWN";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SolidDark Verification ${escapeHtml(input.verificationId)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #132238;
        --muted: #5c6f82;
        --paper: #f6f4ee;
        --panel: #fffdf8;
        --border: #d4cdc0;
        --accent: #b96a2f;
        --success: ${statusTone};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
        background:
          radial-gradient(circle at top right, rgba(185, 106, 47, 0.16), transparent 30%),
          linear-gradient(180deg, #f4efe3 0%, var(--paper) 100%);
        color: var(--ink);
      }
      main { max-width: 980px; margin: 0 auto; padding: 32px 20px 48px; }
      .hero, .panel {
        background: rgba(255, 253, 248, 0.92);
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: 0 20px 60px rgba(19, 34, 56, 0.08);
      }
      .hero { padding: 28px; margin-bottom: 20px; }
      .eyebrow { color: var(--accent); letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px; }
      h1 { font-family: "Space Grotesk", "IBM Plex Sans", sans-serif; font-size: clamp(36px, 7vw, 64px); margin: 10px 0 12px; line-height: 0.95; }
      .lede { font-size: 18px; max-width: 56ch; color: var(--muted); }
      .badge {
        display: inline-block;
        margin-top: 18px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(19, 34, 56, 0.12);
        background: rgba(255, 255, 255, 0.76);
        font-weight: 700;
        color: var(--success);
      }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 20px; }
      .panel { padding: 20px; }
      h2 { margin: 0 0 12px; font-size: 18px; }
      .kv { margin: 0; display: grid; gap: 10px; }
      .kv div { display: grid; gap: 4px; }
      .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
      .value { font-size: 16px; word-break: break-word; }
      ul { margin: 0; padding-left: 18px; }
      .footer { margin-top: 20px; color: var(--muted); font-size: 14px; }
      code { font-family: "IBM Plex Mono", monospace; font-size: 0.95em; }
      a { color: var(--ink); }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">SolidDark Trust Registry</div>
        <h1>${escapeHtml(tierLabel(input.verification.verification_tier))}</h1>
        <p class="lede">This page confirms whether a registry countersignature exists for the published risk passport hash. It does not reveal repository contents and it is not a guarantee of security.</p>
        <div class="badge">Status: ${escapeHtml(statusLabel)} · Tier: ${escapeHtml(input.verification.verification_tier)}</div>
      </section>
      <section class="grid">
        <article class="panel">
          <h2>Verification record</h2>
          <div class="kv">
            <div><span class="label">Verification ID</span><span class="value"><code>${escapeHtml(input.verificationId)}</code></span></div>
            <div><span class="label">Issued at</span><span class="value">${escapeHtml(input.verification.issued_at)}</span></div>
            <div><span class="label">Registry key</span><span class="value"><code>${escapeHtml(input.verification.registry_pubkey_id)}</code></span></div>
            <div><span class="label">Passport hash</span><span class="value"><code>${escapeHtml(input.verification.passport_hash)}</code></span></div>
            <div><span class="label">Signature validity</span><span class="value">${input.verification.signature_valid ? "Valid" : "Invalid or unavailable"}</span></div>
            <div><span class="label">Revoked at</span><span class="value">${escapeHtml(input.verification.revoked_at ?? "Not revoked")}</span></div>
          </div>
        </article>
        <article class="panel">
          <h2>Issuance policy</h2>
          <ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
          <p class="footer">No legal advice. For information purposes only. No guarantee of security. This report may be incomplete.</p>
        </article>
        <article class="panel">
          <h2>Network telemetry</h2>
          <div class="kv">
            <div><span class="label">Issued receipts</span><span class="value">${input.networkStats.issued_total}</span></div>
            <div><span class="label">Active receipts</span><span class="value">${input.networkStats.active_total}</span></div>
            <div><span class="label">Revocations</span><span class="value">${input.networkStats.revoked_total}</span></div>
            <div><span class="label">Benchmark records</span><span class="value">${input.networkStats.benchmark_records_total}</span></div>
            <div><span class="label">Tracked ecosystems</span><span class="value">${escapeHtml(ecosystems)}</span></div>
            <div><span class="label">Latest issuance</span><span class="value">${escapeHtml(input.networkStats.latest_issued_at ?? "UNKNOWN")}</span></div>
          </div>
        </article>
        <article class="panel">
          <h2>How to verify independently</h2>
          <ul>
            <li>Query the JSON endpoint at <code>${escapeHtml(input.verificationUrl)}</code>.</li>
            <li>Verify the envelope signature against the listed registry key ID.</li>
            <li>Check revocation status before relying on the receipt.</li>
          </ul>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

function countersignEnvelope(keyRecord: RegistryKeyRecord, fields: Omit<RegistryEnvelope, "signature">) {
  return signCanonicalJson(fields, keyRecord.secretKey);
}

async function authorizeIssuance(payload: RegistryPublishPayload) {
  const policy = await loadRegistryIssuancePolicy();
  if (policy.status === "unknown") {
    return {
      status: "unknown" as const,
      allow: false,
      issuer: "SolidDark Registry",
      verification_tier: "reviewed" as const,
      reason: policy.unknown_reason ?? "Private registry policy failed to load.",
      notes: [],
      source: policy.source,
    };
  }

  const decision = await policy.policy.beforeIssue({ payload });
  return {
    status: decision.status,
    allow: decision.allow,
    issuer: decision.issuer ?? "SolidDark Registry",
    verification_tier: decision.verification_tier ?? "baseline",
    reason: decision.error_reason ?? decision.unknown_reason ?? decision.notes?.join(" | "),
    notes: decision.notes ?? [],
    source: policy.source,
  };
}

export async function startRegistryServer(options?: RegistryOptions) {
  const dataDir = resolveDataDir(options);
  const apiKey = options?.apiKey ?? process.env.SOLIDDARK_REGISTRY_API_KEY;
  if (!apiKey) {
    throw new Error("SOLIDDARK_REGISTRY_API_KEY is required. Use `soliddark registry dev` for local development defaults.");
  }
  const keyRecord = loadOrCreateKeyRecord(dataDir);
  const database = await loadDatabase(dataDir);
  saveRegistryKey(database.db, keyRecord);
  database.persist();
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 4010;
  let publicBaseUrl = `http://${host}:${port}`;

  const app = Fastify({ logger: false });

  app.get("/v1/status", async () => ({
    status: "ok",
    issuer: REGISTRY_ISSUER,
    registry_pubkey_id: keyRecord.publicKeyId,
    public_key: keyRecord.publicKey,
    private_policy_source: process.env.SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE ?? "@soliddark/private-registry",
    verification_page_base_url: `${publicBaseUrl}/verify`,
    network_stats: getNetworkStats(database.db),
  }));

  app.get("/v1/keys/:keyId", async (request, reply) => {
    const keyId = String((request.params as { keyId?: string }).keyId ?? "");
    const key = getRegistryKey(database.db, keyId);
    if (!key) {
      return reply.code(404).send({ error: "Registry public key not found." });
    }

    return {
      registry_pubkey_id: key.pubkey_id,
      public_key: key.public_key,
      created_at: key.created_at,
    };
  });

  app.get("/v1/bench/stats", async () => {
    return {
      status: "ok",
      network_stats: getNetworkStats(database.db),
    };
  });

  app.post("/v1/issue", async (request, reply) => {
    if (!authenticate(request, apiKey)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const payload = registryPublishPayloadSchema.parse(request.body);
    const policyDecision = await authorizeIssuance(payload);
    if (policyDecision.status === "unknown") {
      return reply.code(503).send({
        error: `Issuance policy unavailable (${policyDecision.source}): ${policyDecision.reason ?? "UNKNOWN"}`,
      });
    }

    if (policyDecision.status === "error") {
      return reply.code(503).send({
        error: `Issuance policy failed (${policyDecision.source}): ${policyDecision.reason ?? "ERROR"}`,
      });
    }

    if (!policyDecision.allow) {
      return reply.code(403).send({
        error: `Issuance denied by policy (${policyDecision.source}): ${policyDecision.reason ?? "Denied"}`,
      });
    }

    const envelopeFields: Omit<RegistryEnvelope, "signature"> = {
      verification_id: randomVerificationId(),
      passport_hash: payload.passport_hash,
      issued_at: new Date().toISOString(),
      issuer: policyDecision.issuer as RegistryEnvelope["issuer"],
      registry_pubkey_id: keyRecord.publicKeyId,
      verification_tier: policyDecision.verification_tier,
    };
    const signature = countersignEnvelope(keyRecord, envelopeFields);
    const envelope = registryEnvelopeSchema.parse({ ...envelopeFields, signature });

    database.db.run(
      `INSERT INTO issuances
      (verification_id, passport_hash, issued_at, issuer, registry_pubkey_id, verification_tier, signature, tool_version, generated_at, ecosystems_json, dependency_count, vuln_count, secret_findings_count, unknowns_count, project_label, policy_notes_json, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        envelope.verification_id,
        envelope.passport_hash,
        envelope.issued_at,
        envelope.issuer,
        envelope.registry_pubkey_id,
        envelope.verification_tier,
        envelope.signature,
        payload.tool_version,
        payload.generated_at,
        JSON.stringify(payload.ecosystems),
        payload.dependency_count,
        payload.vuln_count,
        payload.secret_findings_count,
        payload.unknowns_count,
        payload.project_label ?? null,
        JSON.stringify(policyDecision.notes ?? []),
      ],
    );
    database.persist();

    return {
      ...envelope,
      verification_url: `${publicBaseUrl}/verify/${envelope.verification_id}`,
    };
  });

  app.get("/v1/verify/:verificationId", async (request, reply) => {
    const verificationId = String((request.params as { verificationId?: string }).verificationId ?? "");
    const row = getIssuance(database.db, verificationId);

    if (!row) {
      return reply.code(404).send({
        status: "unknown",
        verification_id: verificationId,
        issued_at: new Date(0).toISOString(),
        passport_hash: "0".repeat(64),
        registry_pubkey_id: keyRecord.publicKeyId,
        verification_tier: "baseline",
        revoked_at: null,
        signature_valid: false,
      });
    }

    const verificationKey = getRegistryKey(database.db, String(row.registry_pubkey_id));
    const signaturePayload = {
      verification_id: String(row.verification_id),
      passport_hash: String(row.passport_hash),
      issued_at: String(row.issued_at),
      issuer: String(row.issuer),
      registry_pubkey_id: String(row.registry_pubkey_id),
      verification_tier: row.verification_tier,
    };

    return registryVerifyResponseSchema.parse({
      status: row.revoked_at ? "revoked" : "valid",
      verification_id: String(row.verification_id),
      issued_at: String(row.issued_at),
      passport_hash: String(row.passport_hash),
      registry_pubkey_id: String(row.registry_pubkey_id),
      verification_tier: row.verification_tier,
      revoked_at: row.revoked_at ? String(row.revoked_at) : null,
      signature_valid: verificationKey
        ? verifyCanonicalJson(signaturePayload, String(row.signature), verificationKey.public_key)
        : false,
    });
  });

  app.get("/verify/:verificationId", async (request, reply) => {
    const verificationId = String((request.params as { verificationId?: string }).verificationId ?? "");
    const issuance = getIssuance(database.db, verificationId);
    const verifyResponse = await app.inject({ method: "GET", url: `/v1/verify/${verificationId}` });
    const verification = JSON.parse(verifyResponse.body) as RegistryVerifyResponse;
    const policyNotes =
      issuance?.policy_notes_json ? (JSON.parse(issuance.policy_notes_json) as string[]) : [];
    if (!issuance) {
      reply.code(404);
    }
    reply.header("Content-Type", "text/html; charset=utf-8");
    return renderVerificationPage({
      verificationId,
      verification,
      policyNotes,
      networkStats: getNetworkStats(database.db),
      verificationUrl: `${publicBaseUrl}/v1/verify/${verificationId}`,
    });
  });

  app.post("/v1/revoke/:verificationId", async (request, reply) => {
    if (!authenticate(request, apiKey)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const verificationId = String((request.params as { verificationId?: string }).verificationId ?? "");
    const now = new Date().toISOString();
    database.db.run(`UPDATE issuances SET revoked_at = ? WHERE verification_id = ?`, [now, verificationId]);
    database.persist();

    const response = await app.inject({ method: "GET", url: `/v1/verify/${verificationId}` });
    return JSON.parse(response.body);
  });

  app.post("/v1/bench/ingest", async (request, reply) => {
    if (!authenticate(request, apiKey)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const payload = benchmarkIngestSchema.parse(request.body);
    for (const [metric, value] of Object.entries(payload.metrics)) {
      database.db.run(
        `INSERT INTO bench_records (ecosystem, metric, value, source, generated_at) VALUES (?, ?, ?, ?, ?)`,
        [payload.ecosystem, metric, value, payload.source, payload.generated_at],
      );
    }
    database.persist();

    return { ok: true };
  });

  app.get("/v1/bench/percentiles", async (request, reply) => {
    const query = request.query as { ecosystem?: string; metric?: string; value?: string };
    const ecosystem = query.ecosystem ?? "";
    const metric = query.metric ?? "";
    const value = Number(query.value ?? "0");

    if (!ecosystem || !metric || Number.isNaN(value)) {
      return reply.code(400).send({ error: "ecosystem, metric, and numeric value are required" });
    }

    const rows = database.db.exec(
      `SELECT value FROM bench_records WHERE ecosystem = ? AND metric = ? ORDER BY value ASC`,
      [ecosystem, metric],
    )[0];

    const values = (rows?.values ?? [])
      .map((row: unknown[]) => Number(row[0]))
      .filter((row: number) => Number.isFinite(row));
    if (values.length === 0) {
      return { percentile: 0, dataset_size: 0 };
    }

    const lessOrEqual = values.filter((item: number) => item <= value).length;
    const percentile = Math.round((lessOrEqual / values.length) * 100);
    return { percentile, dataset_size: values.length };
  });

  let actualPort = port;
  if (options?.listen !== false) {
    await app.listen({ host, port });
    const address = app.server.address();
    actualPort = typeof address === "object" && address ? address.port : port;
    publicBaseUrl = `http://${host}:${actualPort}`;
  }

  return {
    app,
    host,
    port: actualPort,
    apiKey,
    keyRecord,
    dbPath: database.dbPath,
    close: async () => {
      await app.close();
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startRegistryServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
