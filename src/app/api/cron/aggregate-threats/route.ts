import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const events = await prisma.threatEvent.findMany({
      where: {
        reportedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (events.length === 0) {
      return NextResponse.json({ message: "No events", date: dateStr });
    }

    const countByType = (type: string) => events.filter((event) => event.eventType === type).length;

    const domainCounts: Record<string, number> = {};
    events
      .filter((event) => event.domain && event.decision === "blocked")
      .forEach((event) => {
        domainCounts[event.domain!] = (domainCounts[event.domain!] || 0) + 1;
      });
    const topBlockedDomains = Object.entries(domainCounts)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 20)
      .map(([domain, count]) => ({ domain, count }));

    const secretCounts: Record<string, number> = {};
    events
      .filter((event) => event.secretType)
      .forEach((event) => {
        secretCounts[event.secretType!] = (secretCounts[event.secretType!] || 0) + 1;
      });
    const topSecretTypes = Object.entries(secretCounts)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    const agentCounts: Record<string, number> = {};
    events
      .filter((event) => event.agentName)
      .forEach((event) => {
        agentCounts[event.agentName!] = (agentCounts[event.agentName!] || 0) + 1;
      });
    const topAgents = Object.entries(agentCounts)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 10)
      .map(([name, count]) => ({ name, events: count }));

    await prisma.threatDailyStats.upsert({
      where: { date: dateStr },
      create: {
        date: dateStr,
        totalEvents: events.length,
        secretsDetected: countByType("SECRET_DETECTED"),
        domainsBlocked: countByType("NEW_DOMAIN_BLOCKED"),
        exfiltrationAttempts: countByType("EXFILTRATION_ATTEMPT"),
        promptInjections: countByType("PROMPT_INJECTION"),
        volumeAnomalies: countByType("VOLUME_ANOMALY"),
        intentMismatches: countByType("INTENT_MISMATCH"),
        uniqueInstallations: new Set(events.map((event) => event.installationId)).size,
        uniqueAgents: new Set(events.filter((event) => event.agentName).map((event) => event.agentName)).size,
        topBlockedDomains,
        topSecretTypes,
        topAgents,
      },
      update: {
        totalEvents: events.length,
        secretsDetected: countByType("SECRET_DETECTED"),
        domainsBlocked: countByType("NEW_DOMAIN_BLOCKED"),
        exfiltrationAttempts: countByType("EXFILTRATION_ATTEMPT"),
        promptInjections: countByType("PROMPT_INJECTION"),
        volumeAnomalies: countByType("VOLUME_ANOMALY"),
        intentMismatches: countByType("INTENT_MISMATCH"),
        uniqueInstallations: new Set(events.map((event) => event.installationId)).size,
        uniqueAgents: new Set(events.filter((event) => event.agentName).map((event) => event.agentName)).size,
        topBlockedDomains,
        topSecretTypes,
        topAgents,
      },
    });

    const domains = await prisma.threatDomain.findMany({
      where: { isConfirmed: false },
    });

    for (const threatDomain of domains) {
      const newConfidence = Math.min(1, threatDomain.reportedBy * 0.1 + threatDomain.totalBlocks * 0.001);

      if (Math.abs(newConfidence - threatDomain.confidence) > 0.01) {
        await prisma.threatDomain.update({
          where: { id: threatDomain.id },
          data: { confidence: newConfidence },
        });
      }
    }

    return NextResponse.json({
      message: "Done",
      date: dateStr,
      totalEvents: events.length,
    });
  } catch (error) {
    console.error("Aggregation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aggregation failed." },
      { status: 500 },
    );
  }
}
