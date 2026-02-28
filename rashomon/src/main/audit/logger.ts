import crypto from "node:crypto";

import { v4 as uuidv4 } from "uuid";

import { auditLog } from "@main/db/schema";
import { createDatabaseConnection, database, type DatabaseServices } from "@main/db/connection";
import type { AuditEntry, AuditEventType } from "@shared/types";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(",")}}`;
}

function hashEntry(previousHash: string, payload: Record<string, unknown>): string {
  return crypto
    .createHash("sha256")
    .update(previousHash)
    .update(stableStringify(payload))
    .digest("hex");
}

export interface AuditContext {
  agentId?: string | null;
  requestId?: string | null;
  timestamp?: number;
}

export interface AuditLogger {
  logEvent: (
    eventType: AuditEventType,
    details: Record<string, unknown> | string | null,
    context?: AuditContext,
  ) => Promise<AuditEntry>;
  verifyChain: () => Promise<{ valid: boolean; brokenAtId?: string; totalEntries: number }>;
  getRecentEvents: (limit?: number) => Promise<AuditEntry[]>;
}

export function createAuditLogger(services: DatabaseServices = database): AuditLogger {
  return {
    async logEvent(eventType, details, context = {}) {
      const timestamp = context.timestamp ?? Date.now();
      const id = uuidv4();

      const previousEntry = services.sqlite
        .prepare("SELECT receipt_hash AS receiptHash FROM audit_log ORDER BY rowid DESC LIMIT 1")
        .get() as { receiptHash: string } | undefined;

      const serializedDetails =
        typeof details === "string" || details === null ? details : stableStringify(details);

      const payload = {
        id,
        timestamp,
        eventType,
        agentId: context.agentId ?? null,
        requestId: context.requestId ?? null,
        details: serializedDetails,
      };

      const previousHash = previousEntry?.receiptHash ?? "genesis";
      const receiptHash = hashEntry(previousHash, payload);

      services.sqlite
        .prepare(
          "INSERT INTO audit_log (id, timestamp, event_type, agent_id, request_id, details, receipt_hash, previous_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          timestamp,
          eventType,
          context.agentId ?? null,
          context.requestId ?? null,
          serializedDetails,
          receiptHash,
          previousEntry?.receiptHash ?? null,
        );

      return {
        id,
        timestamp: new Date(timestamp),
        eventType,
        agentId: context.agentId ?? null,
        requestId: context.requestId ?? null,
        details: serializedDetails,
        previousHash: previousEntry?.receiptHash ?? null,
        receiptHash,
      };
    },

    async verifyChain() {
      const entries = services.sqlite
        .prepare(
          "SELECT id, timestamp, event_type AS eventType, agent_id AS agentId, request_id AS requestId, details, receipt_hash AS receiptHash, previous_hash AS previousHash FROM audit_log ORDER BY rowid ASC",
        )
        .all() as Array<{
        id: string;
        timestamp: number;
        eventType: AuditEventType;
        agentId: string | null;
        requestId: string | null;
        details: string | null;
        receiptHash: string;
        previousHash: string | null;
      }>;
      let previousHash = "genesis";

      for (const entry of entries) {
        const payload = {
          id: entry.id,
          timestamp: new Date(entry.timestamp).getTime(),
          eventType: entry.eventType,
          agentId: entry.agentId,
          requestId: entry.requestId,
          details: entry.details,
        };

        const expectedHash = hashEntry(previousHash, payload);
        if (entry.receiptHash !== expectedHash) {
          return {
            valid: false,
            brokenAtId: entry.id,
            totalEntries: entries.length,
          };
        }

        previousHash = entry.receiptHash;
      }

      return {
        valid: true,
        totalEntries: entries.length,
      };
    },

    async getRecentEvents(limit = 50) {
      return services.sqlite
        .prepare(
          "SELECT id, timestamp, event_type AS eventType, agent_id AS agentId, request_id AS requestId, details, receipt_hash AS receiptHash, previous_hash AS previousHash FROM audit_log ORDER BY rowid DESC LIMIT ?",
        )
        .all(limit) as AuditEntry[];
    },
  };
}

const defaultLogger = createAuditLogger(createDatabaseConnection());

export const logEvent = defaultLogger.logEvent;
export const verifyChain = defaultLogger.verifyChain;
export const getRecentEvents = defaultLogger.getRecentEvents;
