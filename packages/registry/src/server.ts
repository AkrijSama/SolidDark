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
    CREATE TABLE IF NOT EXISTS issuances (
      verification_id TEXT PRIMARY KEY,
      passport_hash TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      issuer TEXT NOT NULL,
      registry_pubkey_id TEXT NOT NULL,
      signature TEXT NOT NULL,
      tool_version TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      ecosystems_json TEXT NOT NULL,
      dependency_count INTEGER NOT NULL,
      vuln_count INTEGER,
      secret_findings_count INTEGER NOT NULL,
      unknowns_count INTEGER NOT NULL,
      project_label TEXT,
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
      reason: policy.unknown_reason ?? "Private registry policy failed to load.",
      source: policy.source,
    };
  }

  const decision = await policy.policy.beforeIssue({ payload });
  return {
    status: decision.status,
    allow: decision.allow,
    issuer: decision.issuer ?? "SolidDark Registry",
    reason: decision.error_reason ?? decision.unknown_reason ?? decision.notes?.join(" | "),
    source: policy.source,
  };
}

export async function startRegistryServer(options?: RegistryOptions) {
  const dataDir = resolveDataDir(options);
  const apiKey = options?.apiKey ?? process.env.SOLIDDARK_REGISTRY_API_KEY ?? "soliddark-dev-key";
  const keyRecord = loadOrCreateKeyRecord(dataDir);
  const database = await loadDatabase(dataDir);
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 4010;
  let publicBaseUrl = `http://${host}:${port}`;

  const app = Fastify({ logger: false });

  app.get("/v1/status", async () => ({
    status: "ok",
    issuer: REGISTRY_ISSUER,
    registry_pubkey_id: keyRecord.publicKeyId,
    public_key: keyRecord.publicKey,
    db_path: database.dbPath,
    private_policy_source: process.env.SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE ?? "@soliddark/private-registry",
  }));

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
    };
    const signature = countersignEnvelope(keyRecord, envelopeFields);
    const envelope = registryEnvelopeSchema.parse({ ...envelopeFields, signature });

    database.db.run(
      `INSERT INTO issuances
      (verification_id, passport_hash, issued_at, issuer, registry_pubkey_id, signature, tool_version, generated_at, ecosystems_json, dependency_count, vuln_count, secret_findings_count, unknowns_count, project_label, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        envelope.verification_id,
        envelope.passport_hash,
        envelope.issued_at,
        envelope.issuer,
        envelope.registry_pubkey_id,
        envelope.signature,
        payload.tool_version,
        payload.generated_at,
        JSON.stringify(payload.ecosystems),
        payload.dependency_count,
        payload.vuln_count,
        payload.secret_findings_count,
        payload.unknowns_count,
        payload.project_label ?? null,
      ],
    );
    database.persist();

    return {
      ...envelope,
      verification_url: `${publicBaseUrl}/v1/verify/${envelope.verification_id}`,
    };
  });

  app.get("/v1/verify/:verificationId", async (request, reply) => {
    const verificationId = String((request.params as { verificationId?: string }).verificationId ?? "");
    const row = getSingleRow(
      database.db,
      `SELECT verification_id, passport_hash, issued_at, registry_pubkey_id, signature, revoked_at FROM issuances WHERE verification_id = ?`,
      [verificationId],
    );

    if (!row) {
      return reply.code(404).send({
        status: "unknown",
        verification_id: verificationId,
        issued_at: new Date(0).toISOString(),
        passport_hash: "0".repeat(64),
        registry_pubkey_id: keyRecord.publicKeyId,
        revoked_at: null,
        signature_valid: false,
      });
    }

    const signaturePayload = {
      verification_id: String(row.verification_id),
      passport_hash: String(row.passport_hash),
      issued_at: String(row.issued_at),
      issuer: REGISTRY_ISSUER,
      registry_pubkey_id: String(row.registry_pubkey_id),
    };

    return registryVerifyResponseSchema.parse({
      status: row.revoked_at ? "revoked" : "valid",
      verification_id: String(row.verification_id),
      issued_at: String(row.issued_at),
      passport_hash: String(row.passport_hash),
      registry_pubkey_id: String(row.registry_pubkey_id),
      revoked_at: row.revoked_at ? String(row.revoked_at) : null,
      signature_valid: verifyCanonicalJson(signaturePayload, String(row.signature), keyRecord.publicKey),
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
