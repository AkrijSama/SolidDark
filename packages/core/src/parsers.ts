import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import type { Ecosystem, RiskPassport } from "@soliddark/spec";

import { pathExists } from "./fs.js";

export type ParsedDependency = RiskPassport["dependencies"][number];

export async function detectProjectTypes(root: string) {
  const nodeSignals = await Promise.all([
    pathExists(join(root, "package.json")),
    pathExists(join(root, "package-lock.json")),
    pathExists(join(root, "pnpm-lock.yaml")),
  ]);
  const pythonSignals = await Promise.all([
    pathExists(join(root, "requirements.txt")),
    pathExists(join(root, "pyproject.toml")),
  ]);

  const projectTypes: string[] = [];
  const ecosystems: Ecosystem[] = [];

  if (nodeSignals.some(Boolean)) {
    projectTypes.push("node");
    ecosystems.push("node");
  }

  if (pythonSignals.some(Boolean)) {
    projectTypes.push("python");
    ecosystems.push("python");
  }

  return { projectTypes, ecosystems };
}

export async function parseNodeDependencies(root: string) {
  const packageLockPath = join(root, "package-lock.json");
  const pnpmLockPath = join(root, "pnpm-lock.yaml");
  const packageJsonPath = join(root, "package.json");

  if (await pathExists(packageLockPath)) {
    const raw = JSON.parse(await readFile(packageLockPath, "utf8")) as {
      packages?: Record<string, { version?: string; license?: string }>;
      dependencies?: Record<string, { version?: string }>;
    };

    if (raw.packages) {
      return Object.entries(raw.packages)
        .filter(([key]) => key.startsWith("node_modules/"))
        .map(([key, value]) => ({
          name: key.replace(/^node_modules\//, ""),
          version: value.version ?? null,
          ecosystem: "node" as const,
          source: "package-lock.json",
          license_hint: value.license ?? "UNKNOWN",
        }));
    }

    return Object.entries(raw.dependencies ?? {}).map(([name, value]) => ({
      name,
      version: value.version ?? null,
      ecosystem: "node" as const,
      source: "package-lock.json",
      license_hint: "UNKNOWN",
    }));
  }

  if (await pathExists(pnpmLockPath)) {
    const content = await readFile(pnpmLockPath, "utf8");
    const lines = content.split("\n");
    const dependencies: ParsedDependency[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("/") || !trimmed.endsWith(":")) {
        continue;
      }

      const descriptor = trimmed.slice(1, -1);
      const atIndex = descriptor.lastIndexOf("@");
      if (atIndex <= 0) {
        continue;
      }

      dependencies.push({
        name: descriptor.slice(0, atIndex),
        version: descriptor.slice(atIndex + 1),
        ecosystem: "node",
        source: "pnpm-lock.yaml",
        license_hint: "UNKNOWN",
      });
    }

    return dependencies;
  }

  if (await pathExists(packageJsonPath)) {
    const raw = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return [...Object.entries(raw.dependencies ?? {}), ...Object.entries(raw.devDependencies ?? {})].map(([name, version]) => ({
      name,
      version,
      ecosystem: "node" as const,
      source: "package.json",
      license_hint: "UNKNOWN",
    }));
  }

  return [];
}

export async function parsePythonDependencies(root: string) {
  const requirementsPath = join(root, "requirements.txt");
  if (!(await pathExists(requirementsPath))) {
    return [];
  }

  const content = await readFile(requirementsPath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => {
      const match = line.match(/^([A-Za-z0-9_.-]+)\s*([=<>!~]{1,2})?\s*(.+)?$/);
      return {
        name: match?.[1] ?? line,
        version: match?.[3] ?? null,
        ecosystem: "python" as const,
        source: basename(requirementsPath),
        license_hint: "UNKNOWN",
      };
    });
}
