import { Buffer } from "node:buffer";

import { createPolicyEngine, policyEngine, type PolicyEngine } from "@main/engine/policy-engine";
import type { RashomonPolicy, SecretMatch } from "@shared/types";

function compilePattern(pattern: string): RegExp {
  let source = pattern;
  let flags = "g";
  const inlineMatch = pattern.match(/^\(\?([im]+)\)/);

  if (inlineMatch) {
    const inlineFlags = inlineMatch[1];
    source = pattern.slice(inlineMatch[0].length);
    if (inlineFlags.includes("i")) {
      flags += "i";
    }
    if (inlineFlags.includes("m")) {
      flags += "m";
    }
  }

  return new RegExp(source, flags);
}

function calculateEntropy(value: string): number {
  if (value.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

function redactSecret(value: string): string {
  if (value.length <= 8) {
    return `${value[0] ?? ""}***${value.at(-1) ?? ""}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function maybeDecodeBase64Segment(value: string): string | null {
  if (!/^[A-Za-z0-9+/=]{20,}$/.test(value) || value.length % 4 !== 0) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const printableRatio =
      decoded.length === 0
        ? 0
        : decoded.split("").filter((char) => char >= " " || char === "\n" || char === "\r" || char === "\t").length /
          decoded.length;

    return printableRatio >= 0.8 ? decoded : null;
  } catch {
    return null;
  }
}

function collectCandidates(content: string): Array<{ text: string; encoding: SecretMatch["encoding"] }> {
  const candidates: Array<{ text: string; encoding: SecretMatch["encoding"] }> = [
    { text: content, encoding: "plain" },
  ];

  try {
    const decoded = decodeURIComponent(content.replace(/\+/g, "%20"));
    if (decoded !== content) {
      candidates.push({ text: decoded, encoding: "urlencoded" });
    }
  } catch {
    // Ignore malformed URI sequences and keep plain text scanning.
  }

  const base64Candidates = new Set<string>();
  const wholeDecoded = maybeDecodeBase64Segment(content.trim());
  if (wholeDecoded) {
    base64Candidates.add(wholeDecoded);
  }

  for (const match of content.matchAll(/[A-Za-z0-9+/=]{20,}/g)) {
    const decoded = maybeDecodeBase64Segment(match[0]);
    if (decoded) {
      base64Candidates.add(decoded);
    }
  }

  for (const match of content.matchAll(/[=:]([A-Za-z0-9+/=]{20,})/g)) {
    const decoded = maybeDecodeBase64Segment(match[1]);
    if (decoded) {
      base64Candidates.add(decoded);
    }
  }

  for (const decoded of base64Candidates) {
    candidates.push({ text: decoded, encoding: "base64" });
  }

  return candidates;
}

function looksLikeEntropyCandidate(value: string): boolean {
  return (
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /^[A-Za-z0-9+/_=-]+$/.test(value)
  );
}

export interface ScannerInput {
  headers: Record<string, string>;
  body: string;
}

export interface SecretScanner {
  scanRequest: (input: ScannerInput) => Promise<SecretMatch[]>;
  scanText: (text: string, location: "headers" | "body") => Promise<SecretMatch[]>;
}

export function createSecretScanner(engine: PolicyEngine = policyEngine): SecretScanner {
  async function getPolicy(): Promise<RashomonPolicy> {
    if (engine.getPolicies().length === 0) {
      await engine.loadPolicies();
    }

    return engine.getMergedPolicy();
  }

  async function scanText(text: string, location: "headers" | "body"): Promise<SecretMatch[]> {
    const policy = await getPolicy();
    if (!policy.secrets.enabled || text.length === 0) {
      return [];
    }

    const matches: SecretMatch[] = [];

    for (const candidate of collectCandidates(text)) {
      for (const rule of policy.secrets.patterns) {
        const regex = compilePattern(rule.pattern);
        for (const match of candidate.text.matchAll(regex)) {
          const matchedText = match[0];
          matches.push({
            type: rule.name,
            detector: "pattern",
            redactedMatch: redactSecret(matchedText),
            location,
            start: match.index ?? 0,
            end: (match.index ?? 0) + matchedText.length,
            confidence: candidate.encoding === "plain" ? 0.99 : 0.92,
            encoding: candidate.encoding,
          });
        }
      }

      if (!policy.secrets.entropy_detection.enabled) {
        continue;
      }

      for (const match of candidate.text.matchAll(/[A-Za-z0-9+/_=-]{20,}/g)) {
        const token = match[0];
        if (!looksLikeEntropyCandidate(token)) {
          continue;
        }

        const entropy = calculateEntropy(token);
        if (token.length >= policy.secrets.entropy_detection.min_length && entropy >= policy.secrets.entropy_detection.min_entropy) {
          matches.push({
            type: "High Entropy String",
            detector: "entropy",
            redactedMatch: redactSecret(token),
            location,
            start: match.index ?? 0,
            end: (match.index ?? 0) + token.length,
            confidence: Math.min(0.95, entropy / 6),
            encoding: candidate.encoding,
          });
        }
      }
    }

    return matches.filter((match, index, collection) => {
      const signature = `${match.type}:${match.location}:${match.start}:${match.end}:${match.redactedMatch}:${match.encoding}`;
      return collection.findIndex((candidate) => {
        const candidateSignature = `${candidate.type}:${candidate.location}:${candidate.start}:${candidate.end}:${candidate.redactedMatch}:${candidate.encoding}`;
        return candidateSignature === signature;
      }) === index;
    });
  }

  return {
    async scanRequest(input) {
      const headerText = Object.entries(input.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");

      const [headerMatches, bodyMatches] = await Promise.all([
        scanText(headerText, "headers"),
        scanText(input.body, "body"),
      ]);

      return [...headerMatches, ...bodyMatches].sort((left, right) => left.start - right.start);
    },
    scanText,
  };
}

export const secretScanner = createSecretScanner(createPolicyEngine());
export const scanRequest = secretScanner.scanRequest;
