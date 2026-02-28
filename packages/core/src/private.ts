import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { NextAction, RiskPassport } from "@soliddark/spec";

import type { Enricher } from "./enrichment.js";

const DEFAULT_PRIVATE_CORE_MODULE = "@soliddark/private-core";
const PRIVATE_CORE_ENV = "SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE";

export type PrivateCoreHooks = {
  createEnricher?: () => Enricher;
  overlayRiskModel?: (passport: RiskPassport) => Promise<{
    status: "ok" | "unknown" | "error";
    risk_score?: RiskPassport["risk_score"];
    enrichment?: RiskPassport["enrichment"];
    next_actions?: NextAction[];
    notes?: string[];
    unknown_reason?: string;
    error_reason?: string;
  }>;
};

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

export async function loadPrivateCoreHooks(): Promise<{
  status: "ok" | "unknown";
  hooks: PrivateCoreHooks | null;
  source: string;
  unknown_reason?: string;
}> {
  const configuredModule = process.env[PRIVATE_CORE_ENV]?.trim() ?? "";
  const source = configuredModule || DEFAULT_PRIVATE_CORE_MODULE;

  try {
    const imported = (await import(normalizeModuleSpecifier(source))) as {
      default?: PrivateCoreHooks;
      privateCoreHooks?: PrivateCoreHooks;
    };
    return {
      status: "ok",
      hooks: imported.privateCoreHooks ?? imported.default ?? null,
      source,
    };
  } catch (error) {
    if (!configuredModule && isModuleNotFound(error)) {
      return {
        status: "ok",
        hooks: null,
        source,
      };
    }

    return {
      status: "unknown",
      hooks: null,
      source,
      unknown_reason: error instanceof Error ? error.message : `Unable to load ${source}.`,
    };
  }
}
