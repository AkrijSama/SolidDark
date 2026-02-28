import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { DEFAULT_REGISTRY_URL, ensureDir, pathExists, readJsonFile, redactToken, writeJsonFile } from "@soliddark/core";

export type CliConfig = {
  apiKey: string | null;
  registryUrl: string;
  registryPublicKey: string | null;
  registryPublicKeyId: string | null;
  registryPublicKeys: Record<string, string>;
  signingKeyPath: string;
};

export function getCliHomeDir() {
  return join(homedir(), ".soliddark");
}

export function getDefaultSigningKeyPath() {
  return join(getCliHomeDir(), "keys", "signing-key.json");
}

export function getCliConfigPath() {
  return join(getCliHomeDir(), "config.json");
}

export async function readCliConfig(): Promise<CliConfig> {
  const configPath = getCliConfigPath();
  const defaults: CliConfig = {
    apiKey: null,
    registryUrl: DEFAULT_REGISTRY_URL,
    registryPublicKey: null,
    registryPublicKeyId: null,
    registryPublicKeys: {},
    signingKeyPath: getDefaultSigningKeyPath(),
  };

  if (!(await pathExists(configPath))) {
    return defaults;
  }

  const stored = await readJsonFile<Partial<CliConfig>>(configPath);
  return {
    apiKey: stored.apiKey ?? defaults.apiKey,
    registryUrl: stored.registryUrl ?? defaults.registryUrl,
    registryPublicKey: stored.registryPublicKey ?? defaults.registryPublicKey,
    registryPublicKeyId: stored.registryPublicKeyId ?? defaults.registryPublicKeyId,
    registryPublicKeys: stored.registryPublicKeys ?? defaults.registryPublicKeys,
    signingKeyPath: stored.signingKeyPath ?? defaults.signingKeyPath,
  };
}

export async function writeCliConfig(config: CliConfig) {
  await ensureDir(getCliHomeDir());
  await writeJsonFile(getCliConfigPath(), config);
}

export async function initProject(cwd: string) {
  const projectDir = resolve(cwd, ".soliddark");
  await ensureDir(projectDir);
  await writeJsonFile(join(projectDir, "project.json"), {
    initialized_at: new Date().toISOString(),
    disclaimers: [
      "Not legal advice. For information purposes only.",
      "No guarantee of security. This report may be incomplete.",
    ],
    artifacts_dir: ".soliddark/artifacts",
  });
  return projectDir;
}

export function summarizeConfig(config: CliConfig) {
  return {
    registryUrl: config.registryUrl,
    apiKey: config.apiKey ? redactToken(config.apiKey) : null,
    registryPublicKeyId: config.registryPublicKeyId,
    cachedRegistryKeys: Object.keys(config.registryPublicKeys),
    signingKeyPath: config.signingKeyPath,
  };
}
