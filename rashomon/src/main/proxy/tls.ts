import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// @ts-expect-error node-forge does not ship declarations in this workspace.
import forge from "node-forge";

import { resolveDataDir } from "../db/connection";

export interface CertificateBundle {
  certPath: string;
  keyPath: string;
  certPem: string;
  keyPem: string;
}

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
  const ca = ensureCA();
  const paths = caPaths();
  fs.mkdirSync(paths.certsDir, { recursive: true });

  const sanitized = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
  const certPath = path.join(paths.certsDir, `${sanitized}.pem`);
  const keyPath = path.join(paths.certsDir, `${sanitized}.key.pem`);

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      certPath,
      keyPath,
      certPem: fs.readFileSync(certPath, "utf8"),
      keyPem: fs.readFileSync(keyPath, "utf8"),
    };
  }

  const caCert = forge.pki.certificateFromPem(ca.certPem);
  const caKey = forge.pki.privateKeyFromPem(ca.keyPem);
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = generateSerial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  cert.setSubject([
    { name: "commonName", value: domain },
    { name: "organizationName", value: "Rashomon MITM" },
  ]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
    },
    {
      name: "extKeyUsage",
      serverAuth: true,
      clientAuth: false,
    },
    {
      name: "subjectAltName",
      altNames: [{ type: 2, value: domain }],
    },
  ]);
  cert.sign(caKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

  fs.writeFileSync(certPath, certPem, { mode: 0o644 });
  fs.writeFileSync(keyPath, keyPem, { mode: 0o600 });

  return {
    certPath,
    keyPath,
    certPem,
    keyPem,
  };
}
