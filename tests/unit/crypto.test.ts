import { beforeAll, describe, expect, it } from "vitest";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

import { hashEvidenceBundle, signWorkEntry, verifyWorkEntrySignature } from "@/lib/crypto/ledger";
import { decrypt, encrypt } from "@/lib/crypto/vault";

const { encodeBase64 } = naclUtil;

const masterKey = new Uint8Array(Array.from({ length: nacl.secretbox.keyLength }, (_, index) => index + 1));

describe("vault crypto", () => {
  it("encrypts and decrypts a vault payload roundtrip", () => {
    const plaintext = JSON.stringify({
      username: "owner@example.com",
      password: "super-secret",
      apiKey: "sk_live_example",
    });

    const encrypted = encrypt(plaintext, masterKey);
    const decrypted = decrypt(encrypted.encrypted, encrypted.nonce, masterKey);

    expect(decrypted).toBe(plaintext);
    expect(encrypted.encrypted).not.toBe(plaintext);
  });

  it("throws a descriptive error when the wrong key is used", () => {
    const plaintext = JSON.stringify({ password: "secret" });
    const encrypted = encrypt(plaintext, masterKey);
    const wrongKey = new Uint8Array(Array.from({ length: nacl.secretbox.keyLength }, (_, index) => 255 - index));

    expect(() => decrypt(encrypted.encrypted, encrypted.nonce, wrongKey)).toThrow(/Vault decryption failed/i);
  });
});

describe("ledger crypto", () => {
  beforeAll(() => {
    process.env.VAULT_MASTER_KEY = encodeBase64(masterKey);
  });

  it("hashes, signs, and verifies a work entry", () => {
    const payload = {
      projectName: "SolidDark",
      description: "AI legal and continuity platform",
      evidenceHash: hashEvidenceBundle("evidence-bundle"),
      techStack: ["Next.js", "TypeScript", "PostgreSQL"],
    };

    const { signature, publicKey } = signWorkEntry("user-123", payload);

    expect(signature).toBeTruthy();
    expect(publicKey).toBeTruthy();
    expect(hashEvidenceBundle("evidence-bundle")).toHaveLength(64);
    expect(verifyWorkEntrySignature(payload, signature, publicKey)).toBe(true);
  });

  it("fails verification when the payload is tampered with", () => {
    const payload = {
      projectName: "Ledger Original",
      evidenceHash: hashEvidenceBundle("original"),
    };
    const { signature, publicKey } = signWorkEntry("user-456", payload);

    expect(
      verifyWorkEntrySignature(
        {
          ...payload,
          projectName: "Ledger Tampered",
        },
        signature,
        publicKey,
      ),
    ).toBe(false);
  });
});
