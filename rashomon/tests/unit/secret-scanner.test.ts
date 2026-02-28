import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPolicyEngine } from "@main/engine/policy-engine";
import { createSecretScanner } from "@main/engine/secret-scanner";

describe("secret scanner", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rashomon-secret-"));
    fs.mkdirSync(path.join(tempDir, "policies"));
    fs.copyFileSync(
      path.join(process.cwd(), "policies/default.yaml"),
      path.join(tempDir, "policies/default.yaml"),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects AWS, Stripe, JWT, database URLs, PEM keys, and high-entropy strings", async () => {
    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    await engine.loadPolicies();
    const scanner = createSecretScanner(engine);

    const body = [
      "AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF",
      "stripe=sk_live_1234567890abcdefghijklmnop",
      "jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijk1234567890.ABCDEFGHIJKLMNOPQRSTUVWX",
      "db=postgres://user:pass@example.com:5432/db",
      "pem=-----BEGIN PRIVATE KEY-----\nMIICeAIBADANBgkqhkiG9w0BAQEFAASCAmIwggJeAgEAAoGBAM8t\n-----END PRIVATE KEY-----",
      "entropy=Qw9aZr7KpLm2Nx8VbTy4Hs6JuR1CdEf0",
    ].join("\n");

    const matches = await scanner.scanRequest({
      headers: {
        authorization: "Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890AB",
      },
      body,
    });

    expect(matches.map((match) => match.type)).toEqual(
      expect.arrayContaining([
        "AWS Access Key",
        "Stripe Secret Key",
        "JWT Token",
        "Database Connection String",
        "Private Key",
        "GitHub Token",
        "High Entropy String",
      ]),
    );
  });

  it("detects URL-encoded and base64-encoded secrets", async () => {
    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    await engine.loadPolicies();
    const scanner = createSecretScanner(engine);

    const body =
      "encoded=api_key%3Dsk_test_1234567890abcdefghijklmnop&payload=QVBJX0tFWT1naHBfYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwQUI=";

    const matches = await scanner.scanRequest({ headers: {}, body });
    expect(matches.some((match) => match.encoding === "urlencoded")).toBe(true);
    expect(matches.some((match) => match.encoding === "base64")).toBe(true);
  });

  it("avoids false positives on ordinary code", async () => {
    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    await engine.loadPolicies();
    const scanner = createSecretScanner(engine);

    const matches = await scanner.scanRequest({
      headers: {},
      body: `
        export function add(left: number, right: number) {
          const total = left + right;
          return total.toString(16);
        }
      `,
    });

    expect(matches).toHaveLength(0);
  });
});
