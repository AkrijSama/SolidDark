import { createHash } from "node:crypto";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const { decodeBase64, encodeBase64 } = naclUtil;

import { getRequiredEnv } from "@/lib/utils";

function deriveSeed(userId: string) {
  const hash = createHash("sha256");
  hash.update(getRequiredEnv("VAULT_MASTER_KEY"));
  hash.update(":");
  hash.update(userId);
  return hash.digest().subarray(0, nacl.sign.seedLength);
}

export function getUserLedgerKeyPair(userId: string) {
  const seed = deriveSeed(userId);
  return nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
}

export function hashEvidenceBundle(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function signWorkEntry(userId: string, payload: Record<string, unknown>) {
  const keyPair = getUserLedgerKeyPair(userId);
  const message = Buffer.from(JSON.stringify(payload, Object.keys(payload).sort()));
  const signature = nacl.sign.detached(message, keyPair.secretKey);

  return {
    signature: encodeBase64(signature),
    publicKey: encodeBase64(keyPair.publicKey),
  };
}

export function verifyWorkEntrySignature(payload: Record<string, unknown>, signature: string, publicKey: string) {
  try {
    const message = Buffer.from(JSON.stringify(payload, Object.keys(payload).sort()));
    return nacl.sign.detached.verify(message, decodeBase64(signature), decodeBase64(publicKey));
  } catch (error) {
    throw new Error(`Ledger signature verification failed. ${error instanceof Error ? error.message : "Unknown verification error."}`);
  }
}
