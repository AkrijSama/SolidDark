import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { X509Certificate } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { generateCertForDomain, getCAPath, parseSniFromClientHello, shouldBypassMitm } from "@main/proxy/tls";

function buildClientHello(serverName: string): Buffer {
  const hostname = Buffer.from(serverName, "utf8");
  const serverNameExtension = Buffer.concat([
    Buffer.from([0x00, 0x00]),
    Buffer.from([0x00, hostname.length + 5]),
    Buffer.from([0x00, hostname.length + 3]),
    Buffer.from([0x00]),
    Buffer.from([hostname.length >> 8, hostname.length & 0xff]),
    hostname,
  ]);

  const body = Buffer.concat([
    Buffer.from([0x03, 0x03]),
    Buffer.alloc(32, 0x01),
    Buffer.from([0x00]),
    Buffer.from([0x00, 0x02]),
    Buffer.from([0x13, 0x01]),
    Buffer.from([0x01]),
    Buffer.from([0x00]),
    Buffer.from([serverNameExtension.length >> 8, serverNameExtension.length & 0xff]),
    serverNameExtension,
  ]);

  return Buffer.concat([
    Buffer.from([0x16, 0x03, 0x01, ((body.length + 4) >> 8) & 0xff, (body.length + 4) & 0xff]),
    Buffer.from([0x01, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff]),
    body,
  ]);
}

describe("tls hardening", () => {
  afterEach(() => {
    delete process.env.RASHOMON_DATA_DIR;
  });

  it("parses SNI from a TLS ClientHello payload", () => {
    const clientHello = buildClientHello("api.example.test");
    expect(parseSniFromClientHello(clientHello)).toBe("api.example.test");
    expect(parseSniFromClientHello(Buffer.from("not-tls"))).toBeNull();
  });

  it("bypasses known pinned domains and custom glob patterns", () => {
    expect(shouldBypassMitm("api.openai.com")).toBe(true);
    expect(shouldBypassMitm("proxy.internal.example", ["*.internal.example"])).toBe(true);
    expect(shouldBypassMitm("safe.example.test")).toBe(false);
  });

  it("generates SAN-based leaf certificates with short-lived cached bundles", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rashomon-tls-"));
    process.env.RASHOMON_DATA_DIR = tempDir;

    const first = generateCertForDomain("api.example.test");
    const second = generateCertForDomain("api.example.test");

    expect(first.certPem).toBe(second.certPem);
    expect(fs.existsSync(getCAPath())).toBe(true);

    const certificate = new X509Certificate(first.certPem);
    const expiresAt = new Date(certificate.validTo).getTime();
    const ttlMs = expiresAt - Date.now();

    expect(certificate.subjectAltName).toContain("DNS:api.example.test");
    expect(certificate.subjectAltName).toContain("DNS:*.example.test");
    expect(ttlMs).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
  });
});
