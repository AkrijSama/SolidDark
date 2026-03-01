import type { SubscriptionTier } from "@prisma/client";

import { SOUL_RATE_LIMITS, BYOK_UNLIMITED } from "@/lib/constants/rate-limits";
import { prisma } from "@/lib/prisma";

interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  resetAt: string;
  usingOwnKey: boolean;
}

export async function checkSoulRateLimit(
  userId: string,
  tier: SubscriptionTier,
  hasOwnApiKey: boolean,
): Promise<RateLimitResult> {
  if (!userId) {
    throw new Error("checkSoulRateLimit requires a userId.");
  }

  const today = new Date().toISOString().split("T")[0];

  if (hasOwnApiKey && BYOK_UNLIMITED) {
    return {
      allowed: true,
      currentCount: 0,
      limit: Number.POSITIVE_INFINITY,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: getNextMidnightUTC(),
      usingOwnKey: true,
    };
  }

  const tierConfig = SOUL_RATE_LIMITS[tier] ?? SOUL_RATE_LIMITS.FREE;

  try {
    const usage = await prisma.apiUsage.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, messageCount: 0 },
      update: {},
    });

    const remaining = Math.max(0, tierConfig.messagesPerDay - usage.messageCount);

    return {
      allowed: usage.messageCount < tierConfig.messagesPerDay,
      currentCount: usage.messageCount,
      limit: tierConfig.messagesPerDay,
      remaining,
      resetAt: getNextMidnightUTC(),
      usingOwnKey: false,
    };
  } catch (error) {
    throw new Error(`Failed to check Soul rate limit. ${error instanceof Error ? error.message : "Unknown database error."}`);
  }
}

export async function recordSoulUsage(
  userId: string,
  tokensIn: number,
  tokensOut: number,
  estimatedCostCents: number,
): Promise<void> {
  if (!userId) {
    throw new Error("recordSoulUsage requires a userId.");
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    await prisma.apiUsage.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today,
        messageCount: 1,
        tokensIn,
        tokensOut,
        estimatedCostCents,
      },
      update: {
        messageCount: { increment: 1 },
        tokensIn: { increment: tokensIn },
        tokensOut: { increment: tokensOut },
        estimatedCostCents: { increment: estimatedCostCents },
      },
    });
  } catch (error) {
    throw new Error(`Failed to record Soul usage. ${error instanceof Error ? error.message : "Unknown database error."}`);
  }
}

function getNextMidnightUTC(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

export type { RateLimitResult };
