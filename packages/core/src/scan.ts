import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { extname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import {
  type Contradiction,
  type Dependency,
  type ErrorRecord,
  type NextAction,
  type RiskDriver,
  type RiskPassport,
  type ScanManifest,
  type UnknownRecord,
} from "@soliddark/spec";

import { DISCLAIMERS, TOOL_VERSION } from "./constants.js";
import { RegistryPercentileEnricher, type Enricher, NoopEnricher, type PercentileClient } from "./enrichment.js";
import { listFiles, pathExists } from "./fs.js";
import { collectRepoSignal } from "./git.js";
import { parseNodeDependencies, parsePythonDependencies, detectProjectTypes } from "./parsers.js";

const execFileAsync = promisify(execFile);

export type RepoSignal = RiskPassport["repo"];

export type ScanOptions = {
  offline?: boolean;
  includePaths?: boolean;
  enricher?: Enricher;
  registryClient?: PercentileClient | null;
};

type MutableScanState = {
  unknowns: UnknownRecord[];
  errors: ErrorRecord[];
  assumptions: RiskPassport["assumptions"];
  contradictions: Contradiction[];
  steps: ScanManifest["steps"];
};

function createState(): MutableScanState {
  return {
    unknowns: [],
    errors: [],
    assumptions: [],
    contradictions: [],
    steps: [],
  };
}

function addUnknown(state: MutableScanState, source: string, code: string, message: string) {
  state.unknowns.push({ source, code, status: "unknown", message });
}

function addError(state: MutableScanState, source: string, code: string, message: string) {
  state.errors.push({ source, code, status: "error", message });
}

function addStep(state: MutableScanState, step: string, status: "ok" | "unknown" | "error", info?: string) {
  state.steps.push({
    step,
    status,
    details: info ? [info] : [],
    unknown_reason: status === "unknown" ? info : undefined,
    error_reason: status === "error" ? info : undefined,
  });
}

async function commandExists(command: string) {
  try {
    await execFileAsync("bash", ["-lc", `command -v ${command}`]);
    return true;
  } catch {
    return false;
  }
}

async function collectTestsAndCi(root: string, state: MutableScanState) {
  const testCandidates = ["tests", "__tests__", "vitest.config.ts", "pytest.ini", "tox.ini"];
  const ciCandidates = [".github/workflows", ".gitlab-ci.yml", "circle.yml", ".circleci"];

  const testFilesPresent = (await Promise.all(testCandidates.map((candidate) => pathExists(join(root, candidate))))).some(Boolean);
  const ciFilesPresent = (await Promise.all(ciCandidates.map((candidate) => pathExists(join(root, candidate))))).some(Boolean);
  const details = [
    testFilesPresent ? "Test assets detected." : "No obvious test assets detected.",
    ciFilesPresent ? "CI configuration detected." : "No obvious CI configuration detected.",
  ];

  addStep(state, "tests-and-ci", "ok");
  return {
    status: "ok" as const,
    test_files_present: testFilesPresent,
    ci_files_present: ciFilesPresent,
    details,
  };
}

async function collectLicenses(dependencies: Dependency[], state: MutableScanState) {
  const findings = dependencies.map((dependency) => ({
    name: dependency.name,
    ecosystem: dependency.ecosystem,
    license_hint: dependency.license_hint ?? "UNKNOWN",
  }));

  const unknownCount = findings.filter((finding) => !finding.license_hint || finding.license_hint === "UNKNOWN").length;
  if (unknownCount > 0) {
    addUnknown(state, "license-hints", "license-hints-partial", `${unknownCount} dependencies have unknown license hints.`);
    addStep(state, "license-hints", "unknown", `${unknownCount} dependencies could not be resolved.`);
    return {
      status: "unknown" as const,
      findings,
      unknown_reason: `${unknownCount} dependencies have unknown license hints.`,
    };
  }

  addStep(state, "license-hints", "ok");
  return { status: "ok" as const, findings };
}

function previewSecret(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function collectSecrets(root: string, state: MutableScanState, includePaths: boolean) {
  const detectors = [
    { name: "openai", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
    { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
    { name: "github-token", pattern: /\bghp_[A-Za-z0-9]{20,}\b/g },
    { name: "google-api-key", pattern: /\bAIza[0-9A-Za-z\-_]{30,}\b/g },
  ];
  const files = await listFiles(root, {
    exclude: [".git", ".next", "node_modules", "dist", "coverage", "test-results"],
    maxBytes: 512_000,
  });
  const findings: RiskPassport["secrets"]["findings"] = [];

  for (const file of files) {
    if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip"].includes(extname(file))) {
      continue;
    }

    const content = await readFile(file, "utf8").catch(() => "");
    if (!content) {
      continue;
    }

    const lines = content.split("\n");
    lines.forEach((line, index) => {
      detectors.forEach((detector) => {
        const matches = line.match(detector.pattern);
        if (!matches) {
          return;
        }

        matches.forEach((match) => {
          findings.push({
            detector: detector.name,
            file: includePaths ? relative(root, file) : null,
            line: includePaths ? index + 1 : null,
            preview: previewSecret(match),
          });
        });
      });
    });
  }

  if (await commandExists("gitleaks")) {
    addStep(state, "secret-scan", findings.length ? "error" : "ok", "Built-in detectors ran. gitleaks is installed but not invoked automatically in MVP.");
  } else {
    addUnknown(state, "secret-scan", "gitleaks-not-installed", "gitleaks is not installed; only built-in detectors were used.");
    addStep(state, "secret-scan", findings.length ? "error" : "unknown", "Built-in detectors only; gitleaks unavailable.");
  }

  return {
    status: findings.length > 0 ? ("error" as const) : ("ok" as const),
    findings,
    details: findings.length ? [`${findings.length} secret-like value(s) detected.`] : ["No secret-like values detected by built-in scanners."],
  };
}

async function queryOsv(packages: Dependency[]) {
  const queries = packages
    .filter((dependency) => dependency.version)
    .slice(0, 100)
    .map((dependency) => ({
      package: {
        name: dependency.name,
        ecosystem: dependency.ecosystem === "node" ? "npm" : "PyPI",
      },
      version: dependency.version ?? undefined,
    }));

  const response = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });

  if (!response.ok) {
    throw new Error(`OSV request failed with status ${response.status}.`);
  }

  return (await response.json()) as {
    results: Array<{
      vulns?: Array<{
        id?: string;
        summary?: string;
        severity?: Array<{ score?: string }>;
      }>;
    }>;
  };
}

async function collectVulnerabilities(dependencies: Dependency[], state: MutableScanState, offline: boolean) {
  if (offline) {
    addUnknown(state, "vuln-scan", "offline-osv", "OSV lookup was skipped because offline mode was requested.");
    addStep(state, "vuln-scan", "unknown", "offline mode");
    return {
      status: "unknown" as const,
      source: "osv.dev",
      findings: [],
      unknown_reason: "offline mode requested",
    };
  }

  try {
    const batch = await queryOsv(dependencies);
    const findings: RiskPassport["vulnerabilities"]["findings"] = [];

    batch.results.forEach((result, index) => {
      result.vulns?.forEach((vulnerability) => {
        const dependency = dependencies[index];
        if (!dependency) {
          return;
        }

        findings.push({
          ecosystem: dependency.ecosystem,
          package: dependency.name,
          severity: vulnerability.severity?.[0]?.score ?? null,
          advisory_id: vulnerability.id ?? null,
          summary: vulnerability.summary ?? "OSV advisory without summary.",
        });
      });
    });

    addStep(state, "vuln-scan", "ok");
    return {
      status: "ok" as const,
      source: "osv.dev",
      findings,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "OSV lookup failed.";
    addUnknown(state, "vuln-scan", "osv-unavailable", reason);
    addStep(state, "vuln-scan", "unknown", reason);
    return {
      status: "unknown" as const,
      source: "osv.dev",
      findings: [],
      unknown_reason: reason,
    };
  }
}

function calculateRiskScore(options: {
  dependencies: Dependency[];
  vulnerabilities: RiskPassport["vulnerabilities"];
  secrets: RiskPassport["secrets"];
  testsAndCi: RiskPassport["tests_and_ci"];
  unknowns: UnknownRecord[];
  contradictions: Contradiction[];
}) {
  const drivers: RiskDriver[] = [];
  let score = 85;

  if (!options.testsAndCi.ci_files_present) {
    score -= 10;
    drivers.push({
      label: "No CI detected",
      impact: -10,
      rationale: "No workflow or CI configuration was found.",
    });
  }

  if (!options.testsAndCi.test_files_present) {
    score -= 6;
    drivers.push({
      label: "No tests detected",
      impact: -6,
      rationale: "The repository does not expose obvious test assets.",
    });
  }

  if (options.secrets.findings.length > 0) {
    const penalty = Math.min(45, options.secrets.findings.length * 20);
    score -= penalty;
    drivers.push({
      label: "Secret findings",
      impact: -penalty,
      rationale: `${options.secrets.findings.length} secret-like values were detected.`,
    });
  }

  if (options.vulnerabilities.findings.length > 0) {
    const penalty = Math.min(35, options.vulnerabilities.findings.length * 8);
    score -= penalty;
    drivers.push({
      label: "Known vulnerabilities",
      impact: -penalty,
      rationale: `${options.vulnerabilities.findings.length} advisories were returned by OSV.`,
    });
  }

  const unknownPenalty = Math.min(25, options.unknowns.length * 4);
  if (unknownPenalty > 0) {
    score -= unknownPenalty;
    drivers.push({
      label: "Unknowns penalty",
      impact: -unknownPenalty,
      rationale: `${options.unknowns.length} unresolved data points reduce confidence.`,
    });
  }

  if (options.contradictions.length > 0) {
    const contradictionPenalty = Math.min(15, options.contradictions.length * 5);
    score -= contradictionPenalty;
    drivers.push({
      label: "Contradictions detected",
      impact: -contradictionPenalty,
      rationale: `${options.contradictions.length} contradictory project signals were found.`,
    });
  }

  if (options.secrets.findings.length === 0 && options.vulnerabilities.findings.length === 0) {
    drivers.push({
      label: "No critical findings in local checks",
      impact: 0,
      rationale: "Built-in secret scan did not find secrets and known vulnerabilities were not reported.",
    });
  }

  const confidence = Math.max(0.2, Math.min(0.95, 0.9 - options.unknowns.length * 0.08 - options.contradictions.length * 0.05));
  return {
    score: Math.max(0, Math.min(100, score)),
    confidence,
    status: options.unknowns.length > 0 ? ("unknown" as const) : ("ok" as const),
    unknown_penalty: unknownPenalty,
    drivers,
  };
}

function buildNextActions(passport: Omit<RiskPassport, "next_actions">): NextAction[] {
  const actions: NextAction[] = [];
  let rank = 1;

  if (passport.secrets.findings.length > 0) {
    actions.push({
      rank: rank++,
      action: "Rotate any detected credentials and replace them with a secret manager.",
      rationale: "Secret-like values were found in the scanned material.",
    });
  }

  if (passport.vulnerabilities.status !== "ok") {
    actions.push({
      rank: rank++,
      action: "Run the scan online to resolve vulnerability unknowns.",
      rationale: "The vulnerability section is unknown without a successful OSV lookup.",
    });
  }

  if (!passport.tests_and_ci.ci_files_present) {
    actions.push({
      rank: rank++,
      action: "Add CI that runs tests and the SolidDark scan on every release branch.",
      rationale: "CI presence is one of the strongest workflow lock-in signals for buyers.",
    });
  }

  if (!passport.tests_and_ci.test_files_present) {
    actions.push({
      rank: rank++,
      action: "Add at least one automated test suite before seeking external verification.",
      rationale: "Missing tests reduces confidence in operational discipline.",
    });
  }

  if (actions.length === 0) {
    actions.push({
      rank: 1,
      action: "Publish this passport to the SolidDark registry for countersigning.",
      rationale: "Registry verification is the proprietary trust signal buyers can independently check.",
    });
  }

  return actions;
}

function buildContradictions(root: string, projectTypes: string[], state: MutableScanState) {
  const contradictions: Contradiction[] = [];
  if (projectTypes.includes("node")) {
    const nodeLockfiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"].filter((candidate) => {
      const absolute = join(root, candidate);
      return absolute;
    });
    void nodeLockfiles;
  }

  contradictions.forEach((item) => state.contradictions.push(item));
}

export async function scanProject(targetPath: string, options: ScanOptions = {}) {
  const root = resolve(targetPath);
  const state = createState();
  const repo = await collectRepoSignal(root);
  if (repo.status !== "ok") {
    addUnknown(state, "repo", "git-unavailable", repo.unknown_reason ?? "git metadata unavailable");
    addStep(state, "repo", "unknown", repo.unknown_reason ?? "git metadata unavailable");
  } else {
    addStep(state, "repo", "ok");
  }

  const { projectTypes, ecosystems } = await detectProjectTypes(root);
  if (projectTypes.length === 0) {
    addUnknown(state, "detection", "no-project-type", "No supported Node or Python project indicators were found.");
    addStep(state, "project-detection", "unknown", "No supported project indicators found.");
  } else {
    addStep(state, "project-detection", "ok", projectTypes.join(", "));
  }

  const dependencies = [...(await parseNodeDependencies(root)), ...(await parsePythonDependencies(root))]
    .sort((left, right) => `${left.ecosystem}:${left.name}`.localeCompare(`${right.ecosystem}:${right.name}`));

  if (dependencies.length === 0) {
    addUnknown(state, "dependencies", "no-dependencies", "No dependencies were parsed from supported lockfiles or manifests.");
    addStep(state, "dependency-parse", "unknown", "No supported dependencies parsed.");
  } else {
    addStep(state, "dependency-parse", "ok", `${dependencies.length} dependencies`);
  }

  state.assumptions.push({
    source: "scanner",
    message: "Supported ecosystems are limited to Node and Python for this MVP.",
  });

  if (await pathExists(join(root, "package-lock.json")) && await pathExists(join(root, "pnpm-lock.yaml"))) {
    state.contradictions.push({
      source: "dependency-parse",
      message: "Both package-lock.json and pnpm-lock.yaml are present; dependency source of truth may be ambiguous.",
    });
  }

  const vulnerabilities = await collectVulnerabilities(dependencies, state, Boolean(options.offline));
  const secrets = await collectSecrets(root, state, Boolean(options.includePaths));
  const licenses = await collectLicenses(dependencies, state);
  const testsAndCi = await collectTestsAndCi(root, state);
  const riskScore = calculateRiskScore({
    dependencies,
    vulnerabilities,
    secrets,
    testsAndCi,
    unknowns: state.unknowns,
    contradictions: state.contradictions,
  });

  const basePassport: Omit<RiskPassport, "next_actions"> = {
    spec_version: TOOL_VERSION,
    generated_at: new Date().toISOString(),
    tool_version: TOOL_VERSION,
    target_path: root,
    disclaimers: [...DISCLAIMERS],
    repo,
    ecosystems,
    project_types: projectTypes,
    dependencies,
    vulnerabilities,
    secrets,
    licenses,
    tests_and_ci: testsAndCi,
    summary: {
      status: state.unknowns.length > 0 ? "unknown" : "ok",
      dependency_count: dependencies.length,
      vuln_count: vulnerabilities.status === "ok" ? vulnerabilities.findings.length : null,
      secret_findings_count: secrets.findings.length,
      unknowns_count: state.unknowns.length,
    },
    risk_score: riskScore,
    enrichment: {
      status: "unknown",
      percentile_metrics: {},
      notes: [],
      unknown_reason: "enrichment not yet run",
    },
    assumptions: state.assumptions,
    contradictions: state.contradictions,
    unknowns: state.unknowns,
    errors: state.errors,
  };

  const enricher = options.enricher ?? (options.registryClient ? new RegistryPercentileEnricher() : new NoopEnricher());
  const enrichment = await enricher.enrich(basePassport as RiskPassport, { registryClient: options.registryClient ?? null });
  const passport: RiskPassport = {
    ...basePassport,
    enrichment,
    next_actions: [],
  };
  passport.next_actions = buildNextActions(passport);

  const manifest: ScanManifest = {
    spec_version: TOOL_VERSION,
    generated_at: passport.generated_at,
    tool_version: TOOL_VERSION,
    target_path: root,
    steps: state.steps,
    unknowns: state.unknowns,
    errors: state.errors,
    disclaimers: [...DISCLAIMERS],
  };

  return { passport, manifest };
}
