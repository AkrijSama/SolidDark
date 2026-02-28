import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { zipSync, strToU8 } from "fflate";

import {
  DISCLAIMERS,
  TOOL_VERSION,
  canonicalizeJson,
  DEFAULT_REGISTRY_URL,
  ensureDir,
  generateEd25519KeyPair,
  pathExists,
  readJsonFile,
  redactToken,
  renderExecutiveSummary,
  renderRiskPassportMarkdown,
  scanProject,
  sha256Hex,
  signCanonicalJson,
  verifyCanonicalJson,
  writeContinuityPack,
  writeJsonFile,
  writeTextFile,
} from "@soliddark/core";
import { RegistryClient } from "@soliddark/sdk";
import {
  type RegistryEnvelope,
  registryEnvelopeSchema,
  riskPassportSchema,
  type RiskPassport,
} from "@soliddark/spec";

import {
  getCliConfigPath,
  getDefaultSigningKeyPath,
  initProject,
  readCliConfig,
  summarizeConfig,
  writeCliConfig,
} from "./config.js";

type CommandContext = {
  cwd: string;
  args: string[];
};

type SigningRecord = {
  status: "ok" | "unknown" | "error";
  signed_at?: string;
  public_key?: string;
  signature?: string;
  reason?: string;
};

type ParsedOptions = {
  positional: string[];
  flags: Record<string, string | boolean>;
};

function parseOptions(args: string[]): ParsedOptions {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }

    const flag = value.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[flag] = true;
      continue;
    }

    flags[flag] = next;
    index += 1;
  }

  return { positional, flags };
}

async function readSigningKey(path: string) {
  if (!(await pathExists(path))) {
    return null;
  }

  return await readJsonFile<{ publicKey: string; secretKey: string }>(path);
}

async function writeSigningRecord(path: string, record: SigningRecord) {
  await writeJsonFile(path, record);
}

function buildRegistryClient(config: Awaited<ReturnType<typeof readCliConfig>>) {
  return new RegistryClient({
    baseUrl: config.registryUrl,
    apiKey: config.apiKey,
  });
}

async function ensureRegistryMetadata(config: Awaited<ReturnType<typeof readCliConfig>>) {
  const response = await fetch(`${config.registryUrl.replace(/\/+$/, "")}/v1/status`);
  if (!response.ok) {
    throw new Error(`Registry status failed with ${response.status}.`);
  }

  const payload = (await response.json()) as {
    public_key: string;
    registry_pubkey_id: string;
  };
  config.registryPublicKey = payload.public_key;
  config.registryPublicKeyId = payload.registry_pubkey_id;
  config.registryPublicKeys[payload.registry_pubkey_id] = payload.public_key;
  await writeCliConfig(config);
}

async function ensureRegistryKey(config: Awaited<ReturnType<typeof readCliConfig>>, registryPubkeyId: string) {
  if (config.registryPublicKeys[registryPubkeyId]) {
    return config.registryPublicKeys[registryPubkeyId];
  }

  const payload = await buildRegistryClient(config).getPublicKey(registryPubkeyId);
  config.registryPublicKeys[payload.registry_pubkey_id] = payload.public_key;
  if (payload.registry_pubkey_id === config.registryPublicKeyId || !config.registryPublicKey) {
    config.registryPublicKey = payload.public_key;
    config.registryPublicKeyId = payload.registry_pubkey_id;
  }
  await writeCliConfig(config);
  return payload.public_key;
}

function buildArtifactRoot(basePath: string, explicitOut?: string) {
  return explicitOut ? resolve(explicitOut) : resolve(".soliddark", "artifacts", basename(basePath));
}

async function commandInit({ cwd }: CommandContext) {
  const projectDir = await initProject(cwd);
  console.log(`Initialized SolidDark project metadata at ${projectDir}`);
  console.log(`Disclaimers: ${DISCLAIMERS.join(" | ")}`);
}

async function commandKeysGenerate() {
  const config = await readCliConfig();
  const pair = generateEd25519KeyPair();
  await writeJsonFile(config.signingKeyPath, pair);
  console.log(`Generated signing key at ${config.signingKeyPath}`);
  console.log(`Public key: ${pair.publicKey}`);
}

async function commandKeysStatus() {
  const config = await readCliConfig();
  const record = await readSigningKey(config.signingKeyPath);
  console.log(JSON.stringify({
    config_path: getCliConfigPath(),
    signing_key_path: config.signingKeyPath,
    signing_key_present: Boolean(record),
    public_key: record?.publicKey ?? null,
  }, null, 2));
}

async function commandRegistryLogin({ args }: CommandContext) {
  const { flags } = parseOptions(args);
  const apiKey = typeof flags["api-key"] === "string" ? flags["api-key"] : null;
  const registryUrl = typeof flags.url === "string" ? flags.url : DEFAULT_REGISTRY_URL;

  if (!apiKey) {
    throw new Error("--api-key is required");
  }

  const config = await readCliConfig();
  config.apiKey = apiKey;
  config.registryUrl = registryUrl;
  await ensureRegistryMetadata(config);

  console.log(`Stored registry credentials at ${getCliConfigPath()}`);
  console.log(`Registry URL: ${config.registryUrl}`);
  console.log(`API key: ${redactToken(apiKey)}`);
}

async function commandRegistryStatus() {
  const config = await readCliConfig();
  const summary = summarizeConfig(config);
  let remote: unknown = {
    status: "unknown",
    reason: "Registry status was not fetched.",
  };

  try {
    remote = await buildRegistryClient(config).getStatus();
  } catch (error) {
    remote = {
      status: "unknown",
      reason: error instanceof Error ? error.message : "Unable to fetch registry status.",
    };
  }

  console.log(JSON.stringify({
    local: summary,
    remote,
  }, null, 2));
}

async function commandRegistryDev({ args }: CommandContext) {
  const { flags } = parseOptions(args);
  const { startRegistryServer } = await import("@soliddark/registry");
  const port = typeof flags.port === "string" ? Number(flags.port) : 4010;
  const host = typeof flags.host === "string" ? flags.host : "127.0.0.1";
  const dataDir = typeof flags["data-dir"] === "string" ? flags["data-dir"] : undefined;
  const apiKey = process.env.SOLIDDARK_REGISTRY_API_KEY ?? "soliddark-dev-key";

  const server = await startRegistryServer({ port, host, dataDir, apiKey });
  console.log(`SolidDark registry listening on http://${host}:${port}`);
  console.log(`API key: ${server.apiKey}`);
  console.log(`Registry public key id: ${server.keyRecord.publicKeyId}`);
}

async function commandScan({ args }: CommandContext) {
  const { positional, flags } = parseOptions(args);
  const targetPath = positional[0];
  if (!targetPath) {
    throw new Error("scan requires a target path");
  }

  const config = await readCliConfig();
  const outDir = buildArtifactRoot(targetPath, typeof flags.out === "string" ? flags.out : undefined);
  const registryClient = config.registryUrl ? buildRegistryClient(config) : null;
  const { passport, manifest } = await scanProject(targetPath, {
    offline: Boolean(flags.offline),
    includePaths: Boolean(flags["include-paths"]),
    registryClient,
  });

  await ensureDir(outDir);
  const markdown = renderRiskPassportMarkdown(passport);
  const passportPath = join(outDir, "risk-passport.json");
  const markdownPath = join(outDir, "risk-passport.md");
  const manifestPath = join(outDir, "scan-manifest.json");
  const sigPath = join(outDir, "risk-passport.sig");

  await writeJsonFile(passportPath, passport);
  await writeTextFile(markdownPath, markdown);
  await writeJsonFile(manifestPath, manifest);

  const signingKey = await readSigningKey(config.signingKeyPath);
  if (!signingKey) {
    await writeSigningRecord(sigPath, {
      status: "unknown",
      reason: "No local signing key configured. Run `soliddark keys generate` first.",
    });
  } else {
    await writeSigningRecord(sigPath, {
      status: "ok",
      signed_at: new Date().toISOString(),
      public_key: signingKey.publicKey,
      signature: signCanonicalJson(passport, signingKey.secretKey),
    });
  }

  console.log(JSON.stringify({
    status: "ok",
    out_dir: outDir,
    files: [
      passportPath,
      markdownPath,
      sigPath,
      manifestPath,
    ],
    unknowns: passport.unknowns.length,
    errors: passport.errors.length,
  }, null, 2));
}

async function commandContinuity({ args }: CommandContext) {
  const { positional, flags } = parseOptions(args);
  const targetPath = positional[0];
  if (!targetPath) {
    throw new Error("continuity requires a target path");
  }

  const outDir = buildArtifactRoot(targetPath, typeof flags.out === "string" ? flags.out : undefined);
  await ensureDir(outDir);
  const { passport } = await scanProject(targetPath, { offline: true });
  const packRoot = await writeContinuityPack(outDir, passport);

  console.log(JSON.stringify({
    status: "ok",
    continuity_pack: packRoot,
    disclaimers: DISCLAIMERS,
  }, null, 2));
}

function buildPublishPayload(passport: RiskPassport, projectLabel?: string) {
  return {
    passport_hash: sha256Hex(canonicalizeJson(passport)),
    tool_version: passport.tool_version,
    generated_at: passport.generated_at,
    ecosystems: passport.ecosystems,
    dependency_count: passport.summary.dependency_count,
    vuln_count: passport.summary.vuln_count,
    secret_findings_count: passport.summary.secret_findings_count,
    unknowns_count: passport.summary.unknowns_count,
    project_label: projectLabel,
  };
}

async function commandPublish({ args }: CommandContext) {
  const { positional, flags } = parseOptions(args);
  const passportFile = positional[0];
  if (!passportFile) {
    throw new Error("publish requires a risk-passport.json path");
  }

  const config = await readCliConfig();
  if (!config.apiKey) {
    throw new Error("No registry API key configured. Run `soliddark registry login --api-key ...` first.");
  }

  if (!config.registryPublicKey || !config.registryPublicKeyId) {
    await ensureRegistryMetadata(config);
  }

  const passport = riskPassportSchema.parse(await readJsonFile(passportFile));
  const client = buildRegistryClient(config);
  const payload = buildPublishPayload(passport, typeof flags["project-label"] === "string" ? flags["project-label"] : undefined);
  const envelope = await client.issue(payload);

  const outputDir = dirname(resolve(passportFile));
  const registryPath = join(outputDir, "risk-passport.registry.json");
  const registrySigPath = join(outputDir, "risk-passport.registry.sig");
  const verificationUrl = `${config.registryUrl.replace(/\/+$/, "")}/verify/${envelope.verification_id}`;
  await writeJsonFile(registryPath, { ...envelope, verification_url: verificationUrl });
  await writeTextFile(registrySigPath, `${envelope.signature}\n`);

  if (flags["bench-opt-in"]) {
    await client.ingestBenchmark({
      ecosystem: passport.ecosystems[0] ?? "node",
      metrics: {
        dep_count: passport.summary.dependency_count,
        secret_findings_count: passport.summary.secret_findings_count,
        unknowns_count: passport.summary.unknowns_count,
      },
      source: "cli-opt-in",
      generated_at: new Date().toISOString(),
    });
  }

  console.log(JSON.stringify({
    status: "ok",
    verification_id: envelope.verification_id,
    verification_url: verificationUrl,
    registry_pubkey_id: envelope.registry_pubkey_id,
    verification_tier: envelope.verification_tier,
    files: [registryPath, registrySigPath],
    uploaded_fields: Object.keys(payload),
    bench_ingested: Boolean(flags["bench-opt-in"]),
  }, null, 2));
}

async function verifyRegistryEnvelope(envelope: RegistryEnvelope, config: Awaited<ReturnType<typeof readCliConfig>>) {
  if (!config.registryPublicKey || config.registryPublicKeyId !== envelope.registry_pubkey_id) {
    try {
      if (config.registryPublicKeyId === envelope.registry_pubkey_id && config.registryPublicKey) {
        config.registryPublicKeys[config.registryPublicKeyId] = config.registryPublicKey;
      } else {
        await ensureRegistryMetadata(config);
      }
    } catch (error) {
      return {
        status: "unknown" as const,
        message: error instanceof Error ? error.message : "Unable to refresh registry public key.",
      };
    }
  }

  let verificationKey = config.registryPublicKeys[envelope.registry_pubkey_id] ?? null;
  if (!verificationKey) {
    try {
      verificationKey = await ensureRegistryKey(config, envelope.registry_pubkey_id);
    } catch (error) {
      return {
        status: "unknown" as const,
        message: error instanceof Error ? error.message : "Unable to resolve registry signing key.",
      };
    }
  }

  const valid = verificationKey
    ? verifyCanonicalJson(
        {
          verification_id: envelope.verification_id,
          passport_hash: envelope.passport_hash,
          issued_at: envelope.issued_at,
          issuer: envelope.issuer,
          registry_pubkey_id: envelope.registry_pubkey_id,
          verification_tier: envelope.verification_tier,
        },
        envelope.signature,
        verificationKey,
      )
    : false;

  if (!valid) {
    return {
      status: "error" as const,
      message: "Registry countersignature verification failed.",
    };
  }

  try {
    const verifyResult = await buildRegistryClient(config).verify(envelope.verification_id);
    if (verifyResult.status === "revoked") {
      return {
        status: "error" as const,
        message: `Registry record revoked at ${verifyResult.revoked_at}.`,
      };
    }

    return {
      status: "ok" as const,
      message: `Registry record is ${verifyResult.status} at tier ${verifyResult.verification_tier}.`,
    };
  } catch (error) {
    return {
      status: "unknown" as const,
      message: error instanceof Error ? error.message : "Unable to query registry verify endpoint.",
    };
  }
}

async function commandVerify({ args }: CommandContext) {
  const { positional, flags } = parseOptions(args);
  const passportFile = positional[0];
  if (!passportFile) {
    throw new Error("verify requires a risk-passport.json path");
  }

  const passport = riskPassportSchema.parse(await readJsonFile(passportFile));
  const config = await readCliConfig();
  const sigFile = typeof flags.sig === "string" ? flags.sig : join(dirname(resolve(passportFile)), "risk-passport.sig");
  const registryFile =
    typeof flags["registry-envelope"] === "string"
      ? flags["registry-envelope"]
      : join(dirname(resolve(passportFile)), "risk-passport.registry.json");

  const results: Array<{ scope: string; status: "ok" | "unknown" | "error"; message: string }> = [];

  if (await pathExists(sigFile)) {
    const signatureRecord = await readJsonFile<SigningRecord>(sigFile);
    if (signatureRecord.status === "ok" && signatureRecord.signature && signatureRecord.public_key) {
      results.push({
        scope: "local-signature",
        status: verifyCanonicalJson(passport, signatureRecord.signature, signatureRecord.public_key) ? "ok" : "error",
        message: verifyCanonicalJson(passport, signatureRecord.signature, signatureRecord.public_key)
          ? "Local signature verified."
          : "Local signature failed verification.",
      });
    } else {
      results.push({
        scope: "local-signature",
        status: signatureRecord.status,
        message: signatureRecord.reason ?? "Local signature unavailable.",
      });
    }
  } else {
    results.push({
      scope: "local-signature",
      status: "unknown",
      message: "No local signature artifact found.",
    });
  }

  if (await pathExists(registryFile)) {
    const envelope = registryEnvelopeSchema.parse(await readJsonFile(registryFile));
    if (envelope.passport_hash !== sha256Hex(canonicalizeJson(passport))) {
      results.push({
        scope: "registry-envelope",
        status: "error",
        message: "Registry envelope passport hash does not match the local passport.",
      });
    } else {
      results.push({
        scope: "registry-envelope",
        ...(await verifyRegistryEnvelope(envelope, config)),
      });
    }
  } else {
    results.push({
      scope: "registry-envelope",
      status: "unknown",
      message: "No registry envelope artifact found.",
    });
  }

  const hasError = results.some((item) => item.status === "error");
  const hasUnknown = results.some((item) => item.status === "unknown");
  console.log(JSON.stringify({
    overall: hasError ? "FAIL" : hasUnknown ? "UNKNOWN" : "PASS",
    reasons: results,
  }, null, 2));
}

async function commandExportVendorPacket({ args }: CommandContext) {
  const { flags } = parseOptions(args);
  const passportFile = typeof flags.passport === "string" ? flags.passport : null;
  const continuityDir = typeof flags.continuity === "string" ? flags.continuity : null;
  const outValue = typeof flags.out === "string" ? flags.out : join(".soliddark", "vendor-packet");

  if (!passportFile || !continuityDir) {
    throw new Error("export vendor-packet requires --passport and --continuity");
  }

  const passport = riskPassportSchema.parse(await readJsonFile(passportFile));
  const outputPath = resolve(outValue);
  const workingDir = outputPath.endsWith(".zip") ? outputPath.slice(0, -4) : outputPath;
  await ensureDir(workingDir);

  await writeTextFile(join(workingDir, "executive-summary.md"), renderExecutiveSummary(passport));
  await writeTextFile(join(workingDir, "risk-passport.md"), renderRiskPassportMarkdown(passport));
  await writeJsonFile(join(workingDir, "risk-passport.json"), passport);
  await writeTextFile(join(workingDir, "disclaimers.txt"), `${DISCLAIMERS.join("\n")}\n`);

  const registryArtifactPath = join(dirname(resolve(passportFile)), "risk-passport.registry.json");
  let verificationId = "UNKNOWN";
  let verificationTier = "UNKNOWN";
  let verificationUrl = "UNKNOWN";
  if (await pathExists(registryArtifactPath)) {
    const envelope = await readJsonFile<{ verification_id?: string; verification_tier?: string; verification_url?: string }>(registryArtifactPath);
    verificationId = envelope.verification_id ?? "UNKNOWN";
    verificationTier = envelope.verification_tier ?? "UNKNOWN";
    verificationUrl = envelope.verification_url ?? "UNKNOWN";
  }

  await writeTextFile(
    join(workingDir, "verification.txt"),
    `Verification ID: ${verificationId}
Verification tier: ${verificationTier}
Verification URL: ${verificationUrl}
How to verify:
- Local: soliddark verify ${join(workingDir, "risk-passport.json")}
- Registry: use the verification ID against the SolidDark Registry verify endpoint.

${DISCLAIMERS.join("\n")}
`,
  );

  const continuityFiles = await listContinuityFiles(resolve(continuityDir));
  for (const file of continuityFiles) {
    const relative = file.slice(resolve(continuityDir).length + 1);
    await ensureDir(join(workingDir, "continuity-pack", dirname(relative)));
    await writeTextFile(join(workingDir, "continuity-pack", relative), await readFile(file, "utf8"));
  }

  if (outputPath.endsWith(".zip")) {
    const archive = await buildZipFromDirectory(workingDir);
    await writeFileCompat(outputPath, Buffer.from(zipSync(archive)));
  }

  console.log(JSON.stringify({
    status: "ok",
    output: outputPath,
    verification_id: verificationId,
    verification_tier: verificationTier,
    verification_url: verificationUrl,
  }, null, 2));
}

async function listContinuityFiles(root: string): Promise<string[]> {
  const entries = await import("@soliddark/core").then((module) =>
    module.listFiles(root, { exclude: [".DS_Store"] }),
  );
  return entries;
}

async function writeFileCompat(path: string, buffer: Buffer) {
  await import("node:fs/promises").then((module) => module.writeFile(path, buffer));
}

async function buildZipFromDirectory(root: string) {
  const entries = await import("@soliddark/core").then((module) => module.listFiles(root));
  const archive: Record<string, Uint8Array> = {};

  for (const entry of entries) {
    archive[entry.slice(resolve(root).length + 1)] = strToU8(await readFile(entry, "utf8"));
  }

  return archive;
}

export async function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  const [command, subcommand, ...rest] = argv;
  const context: CommandContext = { cwd, args: rest };

  if (!command || command === "--help") {
    console.log(`soliddark init
soliddark keys generate
soliddark keys status
soliddark scan <path> [--out <dir>] [--offline] [--include-paths]
soliddark continuity <path> [--out <dir>]
soliddark registry login --api-key <key> [--url <registry>]
soliddark registry dev [--host <host>] [--port <port>] [--data-dir <dir>]
soliddark registry status
soliddark publish <risk-passport.json> [--project-label <label>] [--bench-opt-in]
soliddark verify <risk-passport.json> [--sig <file>] [--registry-envelope <file>]
soliddark export vendor-packet --passport <file> --continuity <dir> [--out <dir|zip>]`);
    return;
  }

  switch (command) {
    case "init":
      await commandInit(context);
      return;
    case "keys":
      if (subcommand === "generate") {
        await commandKeysGenerate();
        return;
      }
      if (subcommand === "status") {
        await commandKeysStatus();
        return;
      }
      break;
    case "scan":
      await commandScan({ cwd, args: [subcommand ?? "", ...rest].filter(Boolean) });
      return;
    case "continuity":
      await commandContinuity({ cwd, args: [subcommand ?? "", ...rest].filter(Boolean) });
      return;
    case "registry":
      if (subcommand === "login") {
        await commandRegistryLogin(context);
        return;
      }
      if (subcommand === "dev") {
        await commandRegistryDev(context);
        return;
      }
      if (subcommand === "status") {
        await commandRegistryStatus();
        return;
      }
      break;
    case "publish":
      await commandPublish({ cwd, args: [subcommand ?? "", ...rest].filter(Boolean) });
      return;
    case "verify":
      await commandVerify({ cwd, args: [subcommand ?? "", ...rest].filter(Boolean) });
      return;
    case "export":
      if (subcommand === "vendor-packet") {
        await commandExportVendorPacket(context);
        return;
      }
      break;
    default:
      break;
  }

  throw new Error(`Unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`);
}
