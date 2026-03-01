import { NextRequest, NextResponse } from "next/server";
import type { Prisma, ThreatEventType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sanitizeTelemetryEvent, validateTelemetryBatch, type TelemetryEventInput } from "@/lib/services/threat-intelligence";

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
    const events = (Array.isArray((body as { events?: unknown[] }).events)
      ? (body as { events: TelemetryEventInput[] }).events
      : [body as TelemetryEventInput]);
    const validation = validateTelemetryBatch(events);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const sanitizedEvents = events.map(sanitizeTelemetryEvent);

    for (const event of sanitizedEvents) {
      if (!THREAT_EVENT_TYPES.includes(String(event.eventType) as ThreatEventType)) {
        return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
      }
    }

    const installationId = String(sanitizedEvents[0].installationId);
    const now = Date.now();
    const entry = rateLimitMap.get(installationId);

    if (entry && entry.resetAt > now) {
      if (entry.count + sanitizedEvents.length > INGEST_RATE_LIMIT) {
        return NextResponse.json(
          {
            error: "Rate limit",
            retryAfter: Math.ceil((entry.resetAt - now) / 1000),
          },
          { status: 429 },
        );
      }

      entry.count += sanitizedEvents.length;
    } else {
      rateLimitMap.set(installationId, { count: sanitizedEvents.length, resetAt: now + 3_600_000 });
    }

    if (rateLimitMap.size > 10_000) {
      for (const [key, value] of rateLimitMap) {
        if (value.resetAt < now) {
          rateLimitMap.delete(key);
        }
      }
    }

    await prisma.threatEvent.createMany({
      data: sanitizedEvents.map((event) => ({
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

    const blockedDomains = sanitizedEvents
      .filter((event) => event.domain && event.decision === "blocked")
      .map((event) => String(event.domain));

    for (const domain of [...new Set(blockedDomains)]) {
      const incrementBy = blockedDomains.filter((candidate) => candidate === domain).length;
      await prisma.threatDomain.upsert({
        where: { domain },
        create: {
          domain,
          totalBlocks: incrementBy,
          reportedBy: 1,
          category: "unknown",
        },
        update: {
          totalBlocks: {
            increment: incrementBy,
          },
          lastSeen: new Date(),
        },
      });
    }

    return NextResponse.json({ accepted: sanitizedEvents.length });
  } catch (error) {
    console.error("Telemetry ingestion error:", error);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
