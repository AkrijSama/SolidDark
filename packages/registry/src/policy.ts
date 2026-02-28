import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { RegistryPublishPayload } from "@soliddark/spec";

const DEFAULT_PRIVATE_POLICY_MODULE = "@soliddark/private-registry";
const PRIVATE_POLICY_ENV = "SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE";

export interface RegistryIssuancePolicy {
  beforeIssue(input: { payload: RegistryPublishPayload }): Promise<{
    status: "ok" | "unknown" | "error";
    allow: boolean;
    issuer?: string;
    notes?: string[];
    unknown_reason?: string;
    error_reason?: string;
  }>;
}

class PublicIssuancePolicy implements RegistryIssuancePolicy {
  async beforeIssue() {
    return {
      status: "ok" as const,
      allow: true,
      issuer: "SolidDark Registry",
      notes: ["Public baseline issuance policy active."],
    };
  }
}

function normalizeModuleSpecifier(specifier: string) {
  if (specifier.startsWith("file://")) {
    return specifier;
  }

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    return pathToFileURL(resolve(specifier)).href;
  }

  return specifier;
}

function isModuleNotFound(error: unknown) {
  return error instanceof Error && /module not found|cannot find package|cannot find module/i.test(error.message);
}

export async function loadRegistryIssuancePolicy(): Promise<{
  status: "ok" | "unknown";
  policy: RegistryIssuancePolicy;
  source: string;
  unknown_reason?: string;
}> {
  const configuredModule = process.env[PRIVATE_POLICY_ENV]?.trim() ?? "";
  const source = configuredModule || DEFAULT_PRIVATE_POLICY_MODULE;

  try {
    const imported = (await import(normalizeModuleSpecifier(source))) as {
      default?: RegistryIssuancePolicy;
      registryIssuancePolicy?: RegistryIssuancePolicy;
    };
    return {
      status: "ok",
      policy: imported.registryIssuancePolicy ?? imported.default ?? new PublicIssuancePolicy(),
      source,
    };
  } catch (error) {
    if (!configuredModule && isModuleNotFound(error)) {
      return {
        status: "ok",
        policy: new PublicIssuancePolicy(),
        source,
      };
    }

    return {
      status: "unknown",
      policy: new PublicIssuancePolicy(),
      source,
      unknown_reason: error instanceof Error ? error.message : `Unable to load ${source}.`,
    };
  }
}
