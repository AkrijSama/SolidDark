import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export interface DatabaseServices {
  dataDir: string;
  databasePath: string;
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
  close: () => void;
}

const connections = new Map<string, DatabaseServices>();

const bootstrapSql = [
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    process_name TEXT NOT NULL,
    pid INTEGER,
    declared_purpose TEXT,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    total_requests INTEGER NOT NULL DEFAULT 0,
    blocked_requests INTEGER NOT NULL DEFAULT 0,
    threat_score REAL NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id),
    timestamp INTEGER NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    port INTEGER,
    request_headers TEXT,
    request_body_size INTEGER,
    request_body_hash TEXT,
    request_body_preview TEXT,
    response_status INTEGER,
    response_body_size INTEGER,
    decision TEXT NOT NULL,
    decision_reason TEXT NOT NULL,
    policy_rule_id TEXT,
    threat_score REAL NOT NULL DEFAULT 0,
    secrets_detected TEXT,
    intent_analysis TEXT,
    receipt_hash TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS domains (
    domain TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'unknown',
    added_by TEXT NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    yaml_content TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    agent_id TEXT,
    request_id TEXT,
    details TEXT,
    receipt_hash TEXT NOT NULL,
    previous_hash TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp DESC)",
  "CREATE INDEX IF NOT EXISTS idx_requests_agent_id ON requests(agent_id)",
  "CREATE INDEX IF NOT EXISTS idx_requests_domain ON requests(domain)",
  "CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC)",
];

export function resolveDataDir(customDir?: string): string {
  if (customDir) {
    return path.resolve(customDir);
  }

  if (process.env.RASHOMON_DATA_DIR) {
    return path.resolve(process.env.RASHOMON_DATA_DIR);
  }

  return path.join(os.homedir(), ".rashomon");
}

export function getDatabasePath(customDir?: string): string {
  return path.join(resolveDataDir(customDir), "data.db");
}

function bootstrapDatabase(sqlite: Database.Database): void {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  for (const statement of bootstrapSql) {
    sqlite.exec(statement);
  }
}

export function createDatabaseConnection(options: { dataDir?: string } = {}): DatabaseServices {
  let dataDir = resolveDataDir(options.dataDir);
  let databasePath = getDatabasePath(dataDir);
  let cacheKey = path.resolve(databasePath);

  const cached = connections.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (error) {
    if (options.dataDir || !(error instanceof Error) || !("code" in error) || error.code !== "EACCES") {
      throw error;
    }

    dataDir = path.resolve(process.cwd(), ".rashomon");
    databasePath = getDatabasePath(dataDir);
    cacheKey = path.resolve(databasePath);

    const fallbackCached = connections.get(cacheKey);
    if (fallbackCached) {
      return fallbackCached;
    }

    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new Database(databasePath);
  bootstrapDatabase(sqlite);

  const db = drizzle(sqlite, { schema });

  const services: DatabaseServices = {
    dataDir,
    databasePath,
    sqlite,
    db,
    close: () => {
      sqlite.close();
      connections.delete(cacheKey);
    },
  };

  connections.set(cacheKey, services);

  return services;
}

export const database = createDatabaseConnection();
export const db = database.db;
export const sqlite = database.sqlite;
