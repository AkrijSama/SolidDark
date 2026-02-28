import crypto from "node:crypto";

import { desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { createDatabaseConnection, database, type DatabaseServices } from "../db/connection";
import { requests } from "../db/schema";
import type { DecisionAction, DecisionReceipt } from "../../shared/types";

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

export interface ReceiptInput {
  requestId: string;
  requestHash: string;
  decision: DecisionAction;
  reason: string;
  policyRuleId?: string;
  timestamp?: number;
}

export interface ReceiptService {
  generateDecisionReceipt: (input: ReceiptInput) => Promise<DecisionReceipt>;
}

export function createReceiptService(services: DatabaseServices = database): ReceiptService {
  return {
    async generateDecisionReceipt(input) {
      const previous = services.db
        .select({ receiptHash: requests.receiptHash })
        .from(requests)
        .orderBy(desc(requests.timestamp), desc(requests.id))
        .limit(1)
        .get();

      const timestamp = input.timestamp ?? Date.now();
      const previousHash = previous?.receiptHash ?? "genesis";
      const payload = {
        requestId: input.requestId,
        requestHash: input.requestHash,
        decision: input.decision,
        reason: input.reason,
        policyRuleId: input.policyRuleId ?? null,
        timestamp,
      };

      const chainHash = crypto
        .createHash("sha256")
        .update(previousHash)
        .update(stableStringify(payload))
        .digest("hex");

      return {
        id: uuidv4(),
        timestamp,
        requestId: input.requestId,
        requestHash: input.requestHash,
        decision: input.decision,
        reason: input.reason,
        policyRuleId: input.policyRuleId,
        chainHash,
      };
    },
  };
}

const defaultReceiptService = createReceiptService(createDatabaseConnection());

export const generateDecisionReceipt = defaultReceiptService.generateDecisionReceipt;
