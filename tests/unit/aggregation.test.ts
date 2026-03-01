import { describe, expect, it } from "vitest";

import { computeThreatDomainConfidence, summarizeThreatEvents } from "@/lib/services/threat-intelligence";

describe("threat aggregation helpers", () => {
  it("daily aggregation produces correct counts", () => {
    const summary = summarizeThreatEvents([
      {
        installationId: "a",
        eventType: "SECRET_DETECTED",
        domain: "webhook.site",
        decision: "blocked",
        secretType: "aws_key",
        agentName: "cursor",
      },
      {
        installationId: "b",
        eventType: "NEW_DOMAIN_BLOCKED",
        domain: "webhook.site",
        decision: "blocked",
        secretType: null,
        agentName: "cursor",
      },
      {
        installationId: "b",
        eventType: "VOLUME_ANOMALY",
        domain: "evil.example",
        decision: "blocked",
        secretType: null,
        agentName: "claude-code",
      },
    ]);

    expect(summary.totalEvents).toBe(3);
    expect(summary.secretsDetected).toBe(1);
    expect(summary.domainsBlocked).toBe(1);
    expect(summary.volumeAnomalies).toBe(1);
  });

  it("top blocked domains are sorted correctly", () => {
    const summary = summarizeThreatEvents([
      { installationId: "a", eventType: "POLICY_VIOLATION", domain: "a.test", decision: "blocked", secretType: null, agentName: null },
      { installationId: "a", eventType: "POLICY_VIOLATION", domain: "b.test", decision: "blocked", secretType: null, agentName: null },
      { installationId: "a", eventType: "POLICY_VIOLATION", domain: "b.test", decision: "blocked", secretType: null, agentName: null },
    ]);

    expect(summary.topBlockedDomains[0]).toEqual({ domain: "b.test", count: 2 });
    expect(summary.topBlockedDomains[1]).toEqual({ domain: "a.test", count: 1 });
  });

  it("unique installations are counted accurately", () => {
    const summary = summarizeThreatEvents([
      { installationId: "a", eventType: "POLICY_VIOLATION", domain: null, decision: "blocked", secretType: null, agentName: "cursor" },
      { installationId: "a", eventType: "POLICY_VIOLATION", domain: null, decision: "blocked", secretType: null, agentName: "cursor" },
      { installationId: "b", eventType: "POLICY_VIOLATION", domain: null, decision: "blocked", secretType: null, agentName: "aider" },
    ]);

    expect(summary.uniqueInstallations).toBe(2);
    expect(summary.uniqueAgents).toBe(2);
  });

  it("empty day produces no aggregate counts", () => {
    const summary = summarizeThreatEvents([]);

    expect(summary.totalEvents).toBe(0);
    expect(summary.topBlockedDomains).toEqual([]);
    expect(summary.topSecretTypes).toEqual([]);
    expect(summary.topAgents).toEqual([]);
  });

  it("confidence score formula works as expected", () => {
    expect(computeThreatDomainConfidence(1, 10)).toBeCloseTo(0.11, 5);
    expect(computeThreatDomainConfidence(8, 900)).toBe(1);
  });
});
