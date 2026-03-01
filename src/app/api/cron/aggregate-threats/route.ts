import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { computeThreatDomainConfidence, summarizeThreatEvents } from "@/lib/services/threat-intelligence";

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

    const summary = summarizeThreatEvents(events);

    await prisma.threatDailyStats.upsert({
      where: { date: dateStr },
      create: {
        date: dateStr,
        ...summary,
      },
      update: {
        ...summary,
      },
    });

    const domains = await prisma.threatDomain.findMany({
      where: { isConfirmed: false },
    });

    for (const threatDomain of domains) {
      const newConfidence = computeThreatDomainConfidence(threatDomain.reportedBy, threatDomain.totalBlocks);

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
