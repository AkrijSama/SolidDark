import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const domains = await prisma.threatDomain.findMany({
      where: {
        OR: [{ isConfirmed: true }, { confidence: { gte: 0.7 } }],
      },
      select: {
        domain: true,
        confidence: true,
        category: true,
        totalBlocks: true,
        firstSeen: true,
        lastSeen: true,
      },
      orderBy: { totalBlocks: "desc" },
      take: 1000,
    });

    return NextResponse.json(
      {
        domains,
        updatedAt: new Date().toISOString(),
        totalDomains: domains.length,
      },
      {
        headers: { "Cache-Control": "public, max-age=3600" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load threat feed." },
      { status: 500 },
    );
  }
}
