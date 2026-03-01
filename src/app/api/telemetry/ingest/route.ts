import { NextRequest, NextResponse } from "next/server";
import type { Prisma, ThreatEventType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const INGEST_RATE_LIMIT = 100;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const THREAT_EVENT_TYPES: ThreatEventType[] = [
  "SECRET_DETECTED",
  "NEW_DOMAIN_BLOCKED",
  "NEW_DOMAIN_APPROVED",
  "RATE_LIMIT_HIT",
  "VOLUME_ANOMALY",
  "PROMPT_INJECTION",
  "EXFILTRATION_ATTEMPT",
  "POLICY_VIOLATION",
  "INTENT_MISMATCH",
  "SENSITIVE_FILE_READ",
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { events?: Array<Record<string, unknown>> } | Record<string, unknown>;
    const events = Array.isArray((body as { events?: unknown[] }).events) ? (body as { events: Record<string, unknown>[] }).events : [body as Record<string, unknown>];

    if (events.length === 0) {
      return NextResponse.json({ error: "No events" }, { status: 400 });
    }

    if (events.length > 50) {
      return NextResponse.json({ error: "Max 50 per batch" }, { status: 400 });
    }

    for (const event of events) {
      if (!event.installationId || !event.eventType || !event.decision) {
        return NextResponse.json({ error: "Each event needs: installationId, eventType, decision" }, { status: 400 });
      }

      if (!THREAT_EVENT_TYPES.includes(String(event.eventType) as ThreatEventType)) {
        return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
      }

      if (event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)) {
        const metadata = event.metadata as Record<string, unknown>;
        delete metadata.requestBody;
        delete metadata.requestHeaders;
        delete metadata.credentials;
        delete metadata.apiKey;
        delete metadata.password;
        delete metadata.token;
      }
    }

    const installationId = String(events[0].installationId);
    const now = Date.now();
    const entry = rateLimitMap.get(installationId);

    if (entry && entry.resetAt > now) {
      if (entry.count + events.length > INGEST_RATE_LIMIT) {
        return NextResponse.json(
          {
            error: "Rate limit",
            retryAfter: Math.ceil((entry.resetAt - now) / 1000),
          },
          { status: 429 },
        );
      }

      entry.count += events.length;
    } else {
      rateLimitMap.set(installationId, { count: events.length, resetAt: now + 3_600_000 });
    }

    if (rateLimitMap.size > 10_000) {
      for (const [key, value] of rateLimitMap) {
        if (value.resetAt < now) {
          rateLimitMap.delete(key);
        }
      }
    }

    await prisma.threatEvent.createMany({
      data: events.map((event) => ({
        installationId: String(event.installationId),
        eventType: String(event.eventType) as never,
        domain: event.domain ? String(event.domain) : null,
        agentName: event.agentName ? String(event.agentName) : null,
        secretType: event.secretType ? String(event.secretType) : null,
        decision: String(event.decision),
        policyRuleId: event.policyRuleId ? String(event.policyRuleId) : null,
        threatScore: typeof event.threatScore === "number" ? event.threatScore : null,
        requestMethod: event.requestMethod ? String(event.requestMethod) : null,
        bodySize: typeof event.bodySize === "number" ? event.bodySize : null,
        entropyScore: typeof event.entropyScore === "number" ? event.entropyScore : null,
        metadata:
          event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
            ? (event.metadata as Prisma.InputJsonValue)
            : undefined,
      })),
    });

    const blockedDomains = events.filter((event) => event.domain && event.decision === "blocked").map((event) => String(event.domain));

    for (const domain of [...new Set(blockedDomains)]) {
      await prisma.threatDomain.upsert({
        where: { domain },
        create: {
          domain,
          totalBlocks: 1,
          reportedBy: 1,
          category: "unknown",
        },
        update: {
          totalBlocks: {
            increment: blockedDomains.filter((candidate) => candidate === domain).length,
          },
          lastSeen: new Date(),
        },
      });
    }

    return NextResponse.json({ accepted: events.length });
  } catch (error) {
    console.error("Telemetry ingestion error:", error);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
