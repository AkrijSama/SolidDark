import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

import type {
  PolicyDecision,
  PolicyViolation,
  RashomonPolicy,
  RequestManifest,
  ValidationResult,
} from "../../shared/types";

function withDefaultPolicy(policy: Partial<RashomonPolicy>): RashomonPolicy {
  const rawProfiles = ((policy as {
    agents?: {
      profiles?: Array<{
        name?: string;
        processPatterns?: string[];
        process_patterns?: string[];
        allowedDomainsExtra?: string[];
        allowed_domains_extra?: string[];
        maxBodyBytes?: number;
        max_body_bytes?: number;
      }>;
    };
  }).agents?.profiles ?? []);

  return {
    version: policy.version ?? "1.0",
    name: policy.name ?? "Unnamed Policy",
    priority: policy.priority ?? 100,
    global: {
      default_action: policy.global?.default_action ?? "allow",
      log_all_requests: policy.global?.log_all_requests ?? true,
      intent_analysis: policy.global?.intent_analysis ?? false,
      max_request_body_bytes: policy.global?.max_request_body_bytes ?? 10 * 1024 * 1024,
      new_domain_action: policy.global?.new_domain_action ?? "require_approval",
    },
    domains: {
      allowed: policy.domains?.allowed ?? [],
      denied: policy.domains?.denied ?? [],
      require_approval: policy.domains?.require_approval ?? [],
    },
    secrets: {
      enabled: policy.secrets?.enabled ?? true,
      action: policy.secrets?.action ?? "block",
      patterns: policy.secrets?.patterns ?? [],
      entropy_detection: {
        enabled: policy.secrets?.entropy_detection?.enabled ?? true,
        min_length: policy.secrets?.entropy_detection?.min_length ?? 20,
        min_entropy: policy.secrets?.entropy_detection?.min_entropy ?? 4.5,
        action: policy.secrets?.entropy_detection?.action ?? "alert",
      },
    },
    sensitive_files: {
      enabled: policy.sensitive_files?.enabled ?? true,
      action: policy.sensitive_files?.action ?? "alert",
      paths: policy.sensitive_files?.paths ?? [],
    },
    rate_limits: {
      enabled: policy.rate_limits?.enabled ?? true,
      per_agent: {
        requests_per_minute: policy.rate_limits?.per_agent?.requests_per_minute ?? 120,
        requests_per_hour: policy.rate_limits?.per_agent?.requests_per_hour ?? 3000,
        max_concurrent: policy.rate_limits?.per_agent?.max_concurrent ?? 20,
      },
      per_domain: {
        requests_per_minute: policy.rate_limits?.per_domain?.requests_per_minute ?? 60,
        requests_per_hour: policy.rate_limits?.per_domain?.requests_per_hour ?? 1000,
      },
    },
    agents: {
      profiles: rawProfiles.map((profile) => ({
        name: profile.name ?? "unknown",
        processPatterns: profile.processPatterns ?? profile.process_patterns ?? [],
        allowedDomainsExtra: profile.allowedDomainsExtra ?? profile.allowed_domains_extra ?? [],
        maxBodyBytes: profile.maxBodyBytes ?? profile.max_body_bytes ?? 1024 * 1024,
      })),
      unknown_agent: {
        action: policy.agents?.unknown_agent?.action ?? "require_approval",
        max_body_bytes: policy.agents?.unknown_agent?.max_body_bytes ?? 1024 * 1024,
      },
    },
  };
}

function matchesGlob(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i").test(value);
}

export interface LoadedPolicy {
  id: string;
  filePath: string;
  priority: number;
  content: string;
  policy: RashomonPolicy;
  enabled: boolean;
}

export interface PolicyEngine {
  loadPolicies: () => Promise<LoadedPolicy[]>;
  reloadPolicies: () => Promise<LoadedPolicy[]>;
  evaluateRequest: (manifest: RequestManifest) => Promise<PolicyDecision>;
  validatePolicy: (source: string) => ValidationResult;
  getPolicies: () => LoadedPolicy[];
  getMergedPolicy: () => RashomonPolicy;
  getPoliciesDir: () => string;
}

function resolveDefaultPoliciesDir(): string {
  return path.resolve(__dirname, "../../../../policies");
}

export function createPolicyEngine(options: { policiesDir?: string } = {}): PolicyEngine {
  const policiesDir = path.resolve(options.policiesDir ?? resolveDefaultPoliciesDir());
  let loadedPolicies: LoadedPolicy[] = [];
  let mergedPolicy = withDefaultPolicy({});

  function mergePolicies(policiesToMerge: LoadedPolicy[]): RashomonPolicy {
    const sorted = [...policiesToMerge].sort((left, right) => right.priority - left.priority);
    const base = withDefaultPolicy({});

    for (const current of sorted) {
      const policy = current.policy;

      base.version = policy.version ?? base.version;
      base.name = policy.name ?? base.name;
      base.priority = current.priority;
      base.global = { ...base.global, ...policy.global };
      base.domains.allowed = [...base.domains.allowed, ...policy.domains.allowed];
      base.domains.denied = [...base.domains.denied, ...policy.domains.denied];
      base.domains.require_approval = [
        ...base.domains.require_approval,
        ...policy.domains.require_approval,
      ];
      base.secrets = {
        ...base.secrets,
        ...policy.secrets,
        patterns: [...base.secrets.patterns, ...policy.secrets.patterns],
        entropy_detection: {
          ...base.secrets.entropy_detection,
          ...policy.secrets.entropy_detection,
        },
      };
      base.sensitive_files = {
        ...base.sensitive_files,
        ...policy.sensitive_files,
        paths: [...base.sensitive_files.paths, ...policy.sensitive_files.paths],
      };
      base.rate_limits = {
        ...base.rate_limits,
        ...policy.rate_limits,
        per_agent: {
          ...base.rate_limits.per_agent,
          ...policy.rate_limits.per_agent,
        },
        per_domain: {
          ...base.rate_limits.per_domain,
          ...policy.rate_limits.per_domain,
        },
      };
      base.agents = {
        profiles: [...base.agents.profiles, ...policy.agents.profiles],
        unknown_agent: {
          ...base.agents.unknown_agent,
          ...policy.agents.unknown_agent,
        },
      };
    }

    return base;
  }

  function validatePolicy(source: string): ValidationResult {
    try {
      const parsed = yaml.load(source) as Partial<RashomonPolicy> | undefined;
      if (!parsed || typeof parsed !== "object") {
        return { valid: false, errors: ["Policy must be a YAML object."] };
      }

      const errors: string[] = [];

      if (!parsed.name) {
        errors.push("Policy name is required.");
      }

      if (!parsed.global?.default_action) {
        errors.push("global.default_action is required.");
      }

      if (!parsed.domains || !Array.isArray(parsed.domains.allowed) || !Array.isArray(parsed.domains.denied)) {
        errors.push("domains.allowed and domains.denied must be arrays.");
      }

      if (!parsed.secrets || !Array.isArray(parsed.secrets.patterns)) {
        errors.push("secrets.patterns must be an array.");
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : "Unknown YAML validation error."],
      };
    }
  }

  async function loadPolicies(): Promise<LoadedPolicy[]> {
    if (!fs.existsSync(policiesDir)) {
      fs.mkdirSync(policiesDir, { recursive: true });
    }

    const files = fs
      .readdirSync(policiesDir)
      .filter((entry) => entry.endsWith(".yaml") || entry.endsWith(".yml"))
      .sort();

    const nextPolicies: LoadedPolicy[] = [];

    for (const fileName of files) {
      const filePath = path.join(policiesDir, fileName);
      const content = fs.readFileSync(filePath, "utf8");
      const validation = validatePolicy(content);

      if (!validation.valid) {
        throw new Error(`Invalid policy at ${filePath}: ${validation.errors.join("; ")}`);
      }

      const parsed = withDefaultPolicy(yaml.load(content) as Partial<RashomonPolicy>);
      nextPolicies.push({
        id: crypto.randomUUID(),
        filePath,
        priority: parsed.priority ?? 100,
        content,
        policy: parsed,
        enabled: true,
      });
    }

    loadedPolicies = nextPolicies.sort((left, right) => left.priority - right.priority);
    mergedPolicy = mergePolicies(loadedPolicies);

    return loadedPolicies;
  }

  async function reloadPolicies(): Promise<LoadedPolicy[]> {
    return loadPolicies();
  }

  async function evaluateRequest(manifest: RequestManifest): Promise<PolicyDecision> {
    if (loadedPolicies.length === 0) {
      await loadPolicies();
    }

    const violations: PolicyViolation[] = [...manifest.why.policyViolations];
    const anomalies = [...manifest.why.anomalies];
    const domain = manifest.where.domain;
    const matchedProfile = mergedPolicy.agents.profiles.find((profile) =>
      profile.processPatterns.some((pattern) =>
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(manifest.who.processName),
      ),
    );

    for (const pattern of mergedPolicy.domains.denied) {
      if (matchesGlob(pattern, domain)) {
        violations.push({
          ruleId: `domain:deny:${pattern}`,
          category: "domain",
          message: `Destination ${domain} is denied by policy pattern ${pattern}.`,
          severity: "critical",
        });

        return {
          action: "block",
          reason: `Blocked by denied domain rule ${pattern}.`,
          policyRuleId: `domain:deny:${pattern}`,
          source: "policy",
          violations,
          anomalies,
        };
      }
    }

    for (const pattern of mergedPolicy.domains.require_approval) {
      if (matchesGlob(pattern, domain)) {
        violations.push({
          ruleId: `domain:approval:${pattern}`,
          category: "domain",
          message: `Destination ${domain} requires approval due to policy pattern ${pattern}.`,
          severity: "high",
        });

        return {
          action: "require_approval",
          reason: `Destination ${domain} matches approval rule ${pattern}.`,
          policyRuleId: `domain:approval:${pattern}`,
          source: "policy",
          violations,
          anomalies,
        };
      }
    }

    if (manifest.what.bodySize > mergedPolicy.global.max_request_body_bytes) {
      violations.push({
        ruleId: "payload:max-body",
        category: "payload",
        message: `Payload size ${manifest.what.bodySize} exceeds configured global limit.`,
        severity: "critical",
      });

      return {
        action: "block",
        reason: "Payload exceeded the configured maximum request body size.",
        policyRuleId: "payload:max-body",
        source: "policy",
        violations,
        anomalies,
      };
    }

    if (matchedProfile && manifest.what.bodySize > matchedProfile.maxBodyBytes) {
      violations.push({
        ruleId: `agent:${matchedProfile.name}:max-body`,
        category: "agent",
        message: `Payload exceeds ${matchedProfile.name} profile limit.`,
        severity: "high",
      });

      return {
        action: "block",
        reason: `Payload exceeds the ${matchedProfile.name} profile body limit.`,
        policyRuleId: `agent:${matchedProfile.name}:max-body`,
        source: "policy",
        violations,
        anomalies,
      };
    }

    if (!matchedProfile && manifest.what.bodySize > mergedPolicy.agents.unknown_agent.max_body_bytes) {
      violations.push({
        ruleId: "agent:unknown:max-body",
        category: "agent",
        message: "Payload exceeds the unknown agent body limit.",
        severity: "high",
      });

      return {
        action: "block",
        reason: "Payload exceeds the unknown agent body limit.",
        policyRuleId: "agent:unknown:max-body",
        source: "policy",
        violations,
        anomalies,
      };
    }

    if (manifest.why.secretsDetected.length > 0 && mergedPolicy.secrets.enabled) {
      const action = mergedPolicy.secrets.action === "block" ? "block" : "require_approval";
      violations.push({
        ruleId: "secret:detected",
        category: "secret",
        message: `Detected ${manifest.why.secretsDetected.length} potential secrets in outbound content.`,
        severity: mergedPolicy.secrets.action === "block" ? "critical" : "high",
      });

      return {
        action,
        reason:
          mergedPolicy.secrets.action === "block"
            ? "Outbound content contains secrets."
            : "Outbound content contains secrets and requires review.",
        policyRuleId: "secret:detected",
        source: "policy",
        violations,
        anomalies,
      };
    }

    if (!matchedProfile && mergedPolicy.agents.unknown_agent.action !== "allow" && manifest.where.isFirstContact) {
      violations.push({
        ruleId: "agent:unknown:first-request",
        category: "agent",
        message: "Unrecognized agent is making its first observed request.",
        severity: "medium",
      });

      return {
        action: mergedPolicy.agents.unknown_agent.action,
        reason: "Unknown agent requires approval on first contact.",
        policyRuleId: "agent:unknown:first-request",
        source: "policy",
        violations,
        anomalies,
      };
    }

    if (manifest.where.isFirstContact && mergedPolicy.global.new_domain_action !== "allow") {
      violations.push({
        ruleId: "domain:first-contact",
        category: "domain",
        message: `Destination ${domain} has not been seen before.`,
        severity: mergedPolicy.global.new_domain_action === "block" ? "critical" : "high",
      });

      return {
        action: mergedPolicy.global.new_domain_action,
        reason: `First contact with ${domain} requires review.`,
        policyRuleId: "domain:first-contact",
        source: "domain",
        violations,
        anomalies,
      };
    }

    const rateLimitViolation = violations.find((violation) => violation.category === "rate_limit");
    if (rateLimitViolation) {
      return {
        action: "throttle",
        reason: rateLimitViolation.message,
        policyRuleId: rateLimitViolation.ruleId,
        source: "rate_limit",
        violations,
        anomalies,
      };
    }

    const severeIntentViolation = violations.find(
      (violation) => violation.category === "intent" && ["high", "critical"].includes(violation.severity),
    );
    if (severeIntentViolation) {
      return {
        action: "require_approval",
        reason: severeIntentViolation.message,
        policyRuleId: severeIntentViolation.ruleId,
        source: "intent",
        violations,
        anomalies,
      };
    }

    return {
      action: mergedPolicy.global.default_action,
      reason: "Request complies with active policy rules.",
      source: "policy",
      violations,
      anomalies,
    };
  }

  return {
    loadPolicies,
    reloadPolicies,
    evaluateRequest,
    validatePolicy,
    getPolicies: () => loadedPolicies,
    getMergedPolicy: () => mergedPolicy,
    getPoliciesDir: () => policiesDir,
  };
}

export const policyEngine = createPolicyEngine();
export const loadPolicies = policyEngine.loadPolicies;
export const reloadPolicies = policyEngine.reloadPolicies;
export const evaluateRequest = policyEngine.evaluateRequest;
export const validatePolicy = policyEngine.validatePolicy;
