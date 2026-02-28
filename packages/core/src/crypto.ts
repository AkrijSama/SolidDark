import { randomBytes } from "node:crypto";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

import { canonicalizeJson } from "./canonical.js";

const { decodeBase64, encodeBase64 } = naclUtil;

export type Ed25519KeyPair = {
  publicKey: string;
  secretKey: string;
};

export function generateEd25519KeyPair(): Ed25519KeyPair {
  const seed = randomBytes(nacl.sign.seedLength);
  const pair = nacl.sign.keyPair.fromSeed(seed);

  return {
    publicKey: encodeBase64(pair.publicKey),
    secretKey: encodeBase64(pair.secretKey),
  };
}

export function signCanonicalJson(payload: unknown, secretKey: string): string {
  const bytes = new TextEncoder().encode(canonicalizeJson(payload));
  return encodeBase64(nacl.sign.detached(bytes, decodeBase64(secretKey)));
}

export function verifyCanonicalJson(payload: unknown, signature: string, publicKey: string): boolean {
  const bytes = new TextEncoder().encode(canonicalizeJson(payload));
  return nacl.sign.detached.verify(bytes, decodeBase64(signature), decodeBase64(publicKey));
}

export function redactToken(value: string): string {
  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
