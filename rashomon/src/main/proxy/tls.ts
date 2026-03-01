import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { X509Certificate } from "node:crypto";

// @ts-expect-error node-forge does not ship declarations in this workspace.
import forge from "node-forge";

import { resolveDataDir } from "../db/connection";

const LEAF_CERT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PINNED_DOMAIN_PATTERNS = [
  "api.openai.com",
  "api.anthropic.com",
  "statsig.anthropic.com",
  "generativelanguage.googleapis.com",
  "copilot-proxy.githubusercontent.com",
];

export interface CertificateBundle {
  certPath: string;
  keyPath: string;
  certPem: string;
  keyPem: string;
  expiresAt?: number;
}

interface CachedLeafCertificate {
  expiresAt: number;
  bundle: CertificateBundle;
}

const leafCertificateCache = new Map<string, CachedLeafCertificate>();

function rashomonDir(): string {
  return resolveDataDir(process.env.RASHOMON_DATA_DIR ?? path.join(os.homedir(), ".rashomon"));
}

function caPaths() {
  const baseDir = rashomonDir();
  return {
    baseDir,
    certPath: path.join(baseDir, "ca.pem"),
    keyPath: path.join(baseDir, "ca-key.pem"),
    certsDir: path.join(baseDir, "certs"),
  };
}

function generateSerial(): string {
  return Math.floor(Math.random() * 1_000_000_000_000).toString(16);
}

function wildcardForDomain(domain: string): string | null {
  const parts = domain.split(".");
  if (parts.length < 3) {
    return null;
  }
  return `*.${parts.slice(1).join(".")}`;
}

function isBundleFresh(bundle: CertificateBundle): boolean {
  if (!bundle.certPem) {
    return false;
  }

  try {
    const x509 = new X509Certificate(bundle.certPem);
    return new Date(x509.validTo).getTime() > Date.now() + 60_000;
  } catch {
    return false;
  }
}

function loadExistingLeafBundle(certPath: string, keyPath: string): CertificateBundle | null {
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return null;
  }

  const certPem = fs.readFileSync(certPath, "utf8");
  const keyPem = fs.readFileSync(keyPath, "utf8");
  const bundle: CertificateBundle = {
    certPath,
    keyPath,
    certPem,
    keyPem,
    expiresAt: Date.now() + LEAF_CERT_TTL_MS,
  };

  return isBundleFresh(bundle) ? bundle : null;
}

function matchesGlob(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i").test(value);
}

export function getCAPath(): string {
  return caPaths().certPath;
}

export function getTrustInstructions(): string[] {
  return [
    `Linux: import ${getCAPath()} into your browser or system trust store.`,
    `macOS: open Keychain Access, import ${getCAPath()}, then set it to Always Trust.`,
    `Windows: import ${getCAPath()} into Trusted Root Certification Authorities.`,
  ];
}

export function shouldBypassMitm(domain: string, extraPatterns: string[] = []): boolean {
  return [...DEFAULT_PINNED_DOMAIN_PATTERNS, ...extraPatterns].some((pattern) => matchesGlob(pattern, domain));
}

export function ensureCA(): CertificateBundle {
  const paths = caPaths();
  fs.mkdirSync(paths.baseDir, { recursive: true });

  if (fs.existsSync(paths.certPath) && fs.existsSync(paths.keyPath)) {
    return {
      certPath: paths.certPath,
      keyPath: paths.keyPath,
      certPem: fs.readFileSync(paths.certPath, "utf8"),
      keyPem: fs.readFileSync(paths.keyPath, "utf8"),
    };
  }

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = generateSerial();
  certificate.validity.notBefore = new Date();
  certificate.validity.notAfter = new Date();
  certificate.validity.notAfter.setFullYear(certificate.validity.notBefore.getFullYear() + 10);

  const attributes = [
    { name: "commonName", value: "Rashomon Local Root CA" },
    { name: "organizationName", value: "Rashomon" },
    { shortName: "OU", value: "Local Security Proxy" },
  ];

  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, digitalSignature: true, cRLSign: true },
    { name: "subjectKeyIdentifier" },
  ]);
  certificate.sign(keys.privateKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(certificate);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  fs.writeFileSync(paths.certPath, certPem, { mode: 0o644 });
  fs.writeFileSync(paths.keyPath, keyPem, { mode: 0o600 });

  return {
    certPath: paths.certPath,
    keyPath: paths.keyPath,
    certPem,
    keyPem,
  };
}

export function generateCertForDomain(domain: string): CertificateBundle {
  const cached = leafCertificateCache.get(domain);
  if (cached && cached.expiresAt > Date.now() && isBundleFresh(cached.bundle)) {
    return cached.bundle;
  }

  const ca = ensureCA();
  const paths = caPaths();
  fs.mkdirSync(paths.certsDir, { recursive: true });

  const sanitized = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
  const certPath = path.join(paths.certsDir, `${sanitized}.pem`);
  const keyPath = path.join(paths.certsDir, `${sanitized}.key.pem`);
  const existingBundle = loadExistingLeafBundle(certPath, keyPath);
  if (existingBundle) {
    leafCertificateCache.set(domain, {
      expiresAt: Date.now() + LEAF_CERT_TTL_MS,
      bundle: existingBundle,
    });
    return existingBundle;
  }

  const caCert = forge.pki.certificateFromPem(ca.certPem);
  const caKey = forge.pki.privateKeyFromPem(ca.keyPem);
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  const wildcard = wildcardForDomain(domain);

  cert.publicKey = keys.publicKey;
  cert.serialNumber = generateSerial();
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + LEAF_CERT_TTL_MS);
  cert.setSubject([
    { name: "commonName", value: domain },
    { name: "organizationName", value: "Rashomon MITM" },
  ]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    { name: "extKeyUsage", serverAuth: true, clientAuth: false },
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: domain },
        ...(wildcard ? [{ type: 2, value: wildcard }] : []),
      ],
    },
  ]);
  cert.sign(caKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  fs.writeFileSync(certPath, certPem, { mode: 0o644 });
  fs.writeFileSync(keyPath, keyPem, { mode: 0o600 });

  const bundle: CertificateBundle = {
    certPath,
    keyPath,
    certPem,
    keyPem,
    expiresAt: cert.validity.notAfter.getTime(),
  };

  leafCertificateCache.set(domain, {
    expiresAt: bundle.expiresAt ?? Date.now() + LEAF_CERT_TTL_MS,
    bundle,
  });

  return bundle;
}

export function parseSniFromClientHello(buffer: Buffer): string | null {
  if (buffer.length < 5 || buffer[0] !== 0x16) {
    return null;
  }

  const recordLength = buffer.readUInt16BE(3);
  if (buffer.length < 5 + recordLength || buffer[5] !== 0x01) {
    return null;
  }

  let offset = 9;
  offset += 2;
  offset += 32;

  const sessionIdLength = buffer.readUInt8(offset);
  offset += 1 + sessionIdLength;

  const cipherSuitesLength = buffer.readUInt16BE(offset);
  offset += 2 + cipherSuitesLength;

  const compressionMethodsLength = buffer.readUInt8(offset);
  offset += 1 + compressionMethodsLength;

  const extensionsLength = buffer.readUInt16BE(offset);
  offset += 2;
  const extensionsEnd = offset + extensionsLength;

  while (offset + 4 <= extensionsEnd && offset + 4 <= buffer.length) {
    const extensionType = buffer.readUInt16BE(offset);
    const extensionLength = buffer.readUInt16BE(offset + 2);
    offset += 4;

    if (extensionType === 0x0000) {
      const listLength = buffer.readUInt16BE(offset);
      let listOffset = offset + 2;
      const listEnd = listOffset + listLength;

      while (listOffset + 3 <= listEnd && listOffset + 3 <= buffer.length) {
        const nameType = buffer.readUInt8(listOffset);
        const nameLength = buffer.readUInt16BE(listOffset + 1);
        listOffset += 3;

        if (nameType === 0 && listOffset + nameLength <= buffer.length) {
          return buffer.slice(listOffset, listOffset + nameLength).toString("utf8");
        }

        listOffset += nameLength;
      }
    }

    offset += extensionLength;
  }

  return null;
}
