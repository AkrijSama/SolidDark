import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const usageStore = new Map<
    string,
    {
      userId: string;
      date: string;
      messageCount: number;
      tokensIn: number;
      tokensOut: number;
      estimatedCostCents: number;
    }
  >();

  function getKey(userId: string, date: string) {
    return `${userId}:${date}`;
  }

  return {
    usageStore,
    prisma: {
      apiUsage: {
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const key = getKey(where.userId_date.userId, where.userId_date.date);
          const existing = usageStore.get(key);

          if (!existing) {
            const created = {
              userId: create.userId,
              date: create.date,
              messageCount: create.messageCount ?? 0,
              tokensIn: create.tokensIn ?? 0,
              tokensOut: create.tokensOut ?? 0,
              estimatedCostCents: create.estimatedCostCents ?? 0,
            };
            usageStore.set(key, created);
            return created;
          }

          const next = {
            ...existing,
            messageCount: existing.messageCount + (update.messageCount?.increment ?? 0),
            tokensIn: existing.tokensIn + (update.tokensIn?.increment ?? 0),
            tokensOut: existing.tokensOut + (update.tokensOut?.increment ?? 0),
            estimatedCostCents: existing.estimatedCostCents + (update.estimatedCostCents?.increment ?? 0),
          };
          usageStore.set(key, next);
          return next;
        }),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockState.prisma,
}));

import { checkSoulRateLimit, recordSoulUsage } from "@/lib/services/rate-limiter";

describe("rate-limiter", () => {
  beforeEach(() => {
    mockState.usageStore.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-28T12:00:00.000Z"));
  });

  it("FREE tier allows 10 messages and blocks the 11th", async () => {
    for (let count = 0; count < 10; count += 1) {
      const result = await checkSoulRateLimit("user-free", "FREE", false);
      expect(result.allowed).toBe(true);
      await recordSoulUsage("user-free", 10, 20, 2);
    }

    const blocked = await checkSoulRateLimit("user-free", "FREE", false);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.currentCount).toBe(10);
  });

  it("BYOK user is always allowed regardless of tier", async () => {
    const result = await checkSoulRateLimit("user-byok", "FREE", true);

    expect(result.allowed).toBe(true);
    expect(result.usingOwnKey).toBe(true);
    expect(result.limit).toBe(Number.POSITIVE_INFINITY);
  });

  it("usage counter increments correctly", async () => {
    await recordSoulUsage("user-growth", 100, 200, 3);
    await recordSoulUsage("user-growth", 50, 75, 2);

    const result = await checkSoulRateLimit("user-growth", "GROWTH", false);
    expect(result.currentCount).toBe(2);
    expect(result.remaining).toBe(498);
  });

  it("rate limit returns the correct remaining count", async () => {
    await recordSoulUsage("user-starter", 40, 60, 2);
    await recordSoulUsage("user-starter", 40, 60, 2);

    const result = await checkSoulRateLimit("user-starter", "STARTER", false);
    expect(result.currentCount).toBe(2);
    expect(result.remaining).toBe(198);
    expect(result.allowed).toBe(true);
  });
});
