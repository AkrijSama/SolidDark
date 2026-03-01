import type { PrismaClient, ThreatEvent } from "@prisma/client";

const SENSITIVE_METADATA_KEYS = new Set([
  "requestBody",
  "requestHeaders",
  "credentials",
  "apiKey",
  "password",
  "token",
]);

export interface TelemetryEventInput {
  installationId?: string;
  eventType?: string;
  domain?: string;
  agentName?: string;
  secretType?: string;
  decision?: string;
  policyRuleId?: string;
  threatScore?: number;
  requestMethod?: string;
  bodySize?: number;
  entropyScore?: number;
  metadata?: Record<string, unknown> | null;
}

type ThreatEventSummaryInput = Pick<
  ThreatEvent,
  "eventType" | "domain" | "decision" | "secretType" | "agentName" | "installationId"
>;

export function sanitizeTelemetryMetadata(metadata?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const sanitized = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !SENSITIVE_METADATA_KEYS.has(key)),
  );

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

export function sanitizeTelemetryEvent(event: TelemetryEventInput): TelemetryEventInput {
  return {
    ...event,
    metadata: sanitizeTelemetryMetadata(event.metadata),
  };
}

export function validateTelemetryBatch(events: TelemetryEventInput[]): { valid: true } | { valid: false; error: string } {
  if (events.length === 0) {
    return { valid: false, error: "No events" };
  }

  if (events.length > 50) {
    return { valid: false, error: "Max 50 per batch" };
  }

  for (const event of events) {
    if (!event.installationId || !event.eventType || !event.decision) {
      return { valid: false, error: "Each event needs: installationId, eventType, decision" };
    }
  }

  return { valid: true };
}

export function computeThreatDomainConfidence(reportedBy: number, totalBlocks: number): number {
  return Math.min(1, reportedBy * 0.1 + totalBlocks * 0.001);
}

export function summarizeThreatEvents(events: ThreatEventSummaryInput[]) {
  const countByType = (type: ThreatEvent["eventType"]) => events.filter((event) => event.eventType === type).length;

  const domainCounts: Record<string, number> = {};
  const secretCounts: Record<string, number> = {};
  const agentCounts: Record<string, number> = {};

  for (const event of events) {
    if (event.domain && event.decision === "blocked") {
      domainCounts[event.domain] = (domainCounts[event.domain] || 0) + 1;
    }

    if (event.secretType) {
      secretCounts[event.secretType] = (secretCounts[event.secretType] || 0) + 1;
    }

    if (event.agentName) {
      agentCounts[event.agentName] = (agentCounts[event.agentName] || 0) + 1;
    }
  }

  return {
    totalEvents: events.length,
    secretsDetected: countByType("SECRET_DETECTED"),
    domainsBlocked: countByType("NEW_DOMAIN_BLOCKED"),
    exfiltrationAttempts: countByType("EXFILTRATION_ATTEMPT"),
    promptInjections: countByType("PROMPT_INJECTION"),
    volumeAnomalies: countByType("VOLUME_ANOMALY"),
    intentMismatches: countByType("INTENT_MISMATCH"),
    uniqueInstallations: new Set(events.map((event) => event.installationId)).size,
    uniqueAgents: new Set(events.filter((event) => event.agentName).map((event) => event.agentName)).size,
    topBlockedDomains: Object.entries(domainCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([domain, count]) => ({ domain, count })),
    topSecretTypes: Object.entries(secretCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count })),
    topAgents: Object.entries(agentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, events: count })),
  };
}

export async function getThreatIntelSnapshot(
  prisma: Pick<PrismaClient, "threatDailyStats" | "threatDomain" | "threatEvent">,
) {
  const today = new Date();
  const todayStart = new Date(`${today.toISOString().split("T")[0]}T00:00:00.000Z`);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [dailyStats, topDomains, totalEvents, todayEvents, confirmedDomains, installationRows, recentEvents] =
    await Promise.all([
      prisma.threatDailyStats.findMany({
        where: { date: { gte: thirtyDaysAgo.toISOString().split("T")[0] } },
        orderBy: { date: "asc" },
      }),
      prisma.threatDomain.findMany({
        orderBy: { totalBlocks: "desc" },
        take: 25,
      }),
      prisma.threatEvent.count(),
      prisma.threatEvent.count({
        where: { reportedAt: { gte: todayStart } },
      }),
      prisma.threatDomain.count({
        where: { isConfirmed: true },
      }),
      prisma.threatEvent.findMany({
        distinct: ["installationId"],
        select: { installationId: true },
      }),
      prisma.threatEvent.findMany({
        where: { reportedAt: { gte: thirtyDaysAgo } },
        select: { secretType: true, agentName: true },
      }),
    ]);

  const secretTypeCounts: Record<string, number> = {};
  const agentCounts: Record<string, number> = {};

  for (const event of recentEvents) {
    if (event.secretType) {
      secretTypeCounts[event.secretType] = (secretTypeCounts[event.secretType] || 0) + 1;
    }
    if (event.agentName) {
      agentCounts[event.agentName] = (agentCounts[event.agentName] || 0) + 1;
    }
  }

  return {
    dailyStats,
    topDomains,
    totalEvents,
    todayEvents,
    confirmedDomains,
    uniqueInstallations: installationRows.length,
    topSecretTypes: Object.entries(secretTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count })),
    topAgents: Object.entries(agentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, events: count })),
  };
}
