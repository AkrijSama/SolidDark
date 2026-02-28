import type { RiskPassport } from "@soliddark/spec";

export function renderRiskPassportMarkdown(passport: RiskPassport) {
  const lines: string[] = [];
  lines.push("# SolidDark Risk Passport");
  lines.push("");
  lines.push(`Generated: ${passport.generated_at}`);
  lines.push(`Tool version: ${passport.tool_version}`);
  lines.push("");
  lines.push("## Disclaimers");
  lines.push("");
  passport.disclaimers.forEach((disclaimer) => lines.push(`- ${disclaimer}`));
  lines.push("");
  lines.push("## What we know");
  lines.push("");
  lines.push(`- Ecosystems detected: ${passport.ecosystems.join(", ") || "none"}`);
  lines.push(`- Dependencies parsed: ${passport.summary.dependency_count}`);
  lines.push(`- Secret findings: ${passport.summary.secret_findings_count}`);
  lines.push(`- Vulnerability findings: ${passport.summary.vuln_count ?? "UNKNOWN"}`);
  lines.push(`- CI detected: ${passport.tests_and_ci.ci_files_present ? "yes" : "no"}`);
  lines.push(`- Tests detected: ${passport.tests_and_ci.test_files_present ? "yes" : "no"}`);
  lines.push("");
  lines.push("## What we don’t know");
  lines.push("");
  if (passport.unknowns.length === 0) {
    lines.push("- No explicit unknowns were recorded.");
  } else {
    passport.unknowns.forEach((item) => lines.push(`- [${item.source}] ${item.message}`));
  }
  lines.push("");
  lines.push("## Assumptions made");
  lines.push("");
  if (passport.assumptions.length === 0) {
    lines.push("- No additional assumptions recorded.");
  } else {
    passport.assumptions.forEach((item) => lines.push(`- [${item.source}] ${item.message}`));
  }
  lines.push("");
  lines.push("## Contradictions detected");
  lines.push("");
  if (passport.contradictions.length === 0) {
    lines.push("- No contradictions detected.");
  } else {
    passport.contradictions.forEach((item) => lines.push(`- [${item.source}] ${item.message}`));
  }
  lines.push("");
  lines.push("## Risk score + drivers + confidence");
  lines.push("");
  lines.push(`- Score: ${passport.risk_score.score}/100`);
  lines.push(`- Confidence: ${(passport.risk_score.confidence * 100).toFixed(0)}%`);
  lines.push(`- Status: ${passport.risk_score.status.toUpperCase()}`);
  passport.risk_score.drivers.forEach((driver) => lines.push(`- ${driver.label}: ${driver.rationale} (${driver.impact})`));
  lines.push("");
  lines.push("## Next actions");
  lines.push("");
  passport.next_actions.forEach((item) => lines.push(`${item.rank}. ${item.action} ${item.rationale}`));
  lines.push("");
  lines.push("## Dependency inventory");
  lines.push("");
  if (passport.dependencies.length === 0) {
    lines.push("- No dependencies parsed.");
  } else {
    passport.dependencies.forEach((dependency) => {
      lines.push(`- ${dependency.ecosystem}: ${dependency.name}@${dependency.version ?? "UNKNOWN"} (${dependency.source})`);
    });
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function renderExecutiveSummary(passport: RiskPassport) {
  return `# Executive Summary

SolidDark generated this seed-stage vendor packet for informational purposes only.

- Risk score: ${passport.risk_score.score}/100
- Confidence: ${(passport.risk_score.confidence * 100).toFixed(0)}%
- Dependencies: ${passport.summary.dependency_count}
- Vulnerabilities: ${passport.summary.vuln_count ?? "UNKNOWN"}
- Secret findings: ${passport.summary.secret_findings_count}
- Unknowns: ${passport.summary.unknowns_count}

## Buyer-facing note

This packet is designed to support procurement diligence. It is not legal advice, does not create any attorney-client relationship, and does not guarantee security or compliance.
`;
}
