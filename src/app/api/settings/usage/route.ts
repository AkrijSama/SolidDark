import { NextResponse } from "next/server";

import { SOUL_RATE_LIMITS } from "@/lib/constants/rate-limits";
import { prisma } from "@/lib/prisma";
import { hasValidUserApiKey } from "@/lib/services/user-api-keys";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: {
        id: true,
        subscriptionTier: true,
        aiProvider: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const today = new Date().toISOString().split("T")[0];
    const tierConfig = SOUL_RATE_LIMITS[user.subscriptionTier] || SOUL_RATE_LIMITS.FREE;

    const todayUsage = await prisma.apiUsage.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyUsage = await prisma.apiUsage.findMany({
      where: {
        userId: user.id,
        date: { gte: thirtyDaysAgo.toISOString().split("T")[0] },
      },
      orderBy: { date: "asc" },
    });

    const hasOwnKey = await hasValidUserApiKey(user.id, user.aiProvider);
    const totalMessages30d = monthlyUsage.reduce((sum, day) => sum + day.messageCount, 0);
    const totalCost30d = monthlyUsage.reduce((sum, day) => sum + day.estimatedCostCents, 0);

    return NextResponse.json({
      today: {
        messagesUsed: todayUsage?.messageCount || 0,
        limit: tierConfig.messagesPerDay,
        remaining: Math.max(0, tierConfig.messagesPerDay - (todayUsage?.messageCount || 0)),
        limitLabel: tierConfig.label,
      },
      monthly: {
        totalMessages: totalMessages30d,
        estimatedCostCents: totalCost30d,
        dailyBreakdown: monthlyUsage.map((day) => ({
          date: day.date,
          messages: day.messageCount,
          costCents: day.estimatedCostCents,
        })),
      },
      tier: user.subscriptionTier,
      hasOwnApiKey: hasOwnKey,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load usage." },
      { status: 500 },
    );
  }
}
