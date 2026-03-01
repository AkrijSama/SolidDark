import { beforeEach, describe, expect, it, vi } from "vitest";

type Provider = "CLAUDE_API" | "OPENAI_API";

const mockState = vi.hoisted(() => {
  const records = new Map<
    string,
    {
      id: string;
      userId: string;
      provider: Provider;
      encryptedKey: string;
      nonce: string;
      keyPrefix: string;
      isValid: boolean;
      lastUsed: Date | null;
      lastValidated: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();

  const keyFor = (userId: string, provider: Provider) => `${userId}:${provider}`;

  return {
    records,
    prisma: {
      userApiKey: {
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const key = keyFor(where.userId_provider.userId, where.userId_provider.provider);
          const existing = records.get(key);

          if (!existing) {
            const record = {
              id: `${create.userId}-${create.provider}`,
              userId: create.userId,
              provider: create.provider,
              encryptedKey: create.encryptedKey,
              nonce: create.nonce,
              keyPrefix: create.keyPrefix,
              isValid: create.isValid,
              lastUsed: null,
              lastValidated: null,
              createdAt: new Date("2026-02-28T00:00:00.000Z"),
              updatedAt: new Date("2026-02-28T00:00:00.000Z"),
            };
            records.set(key, record);
            return record;
          }

          const next = {
            ...existing,
            encryptedKey: update.encryptedKey,
            nonce: update.nonce,
            keyPrefix: update.keyPrefix,
            isValid: update.isValid,
            updatedAt: update.updatedAt,
          };
          records.set(key, next);
          return next;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return records.get(keyFor(where.userId_provider.userId, where.userId_provider.provider)) ?? null;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          for (const [key, value] of records.entries()) {
            if (value.id === where.id) {
              const next = { ...value, ...data };
              records.set(key, next);
              return next;
            }
          }

          throw new Error("Record not found");
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          const key = keyFor(where.userId, where.provider);
          const existing = records.get(key);

          if (!existing) {
            return { count: 0 };
          }

          records.set(key, { ...existing, ...data });
          return { count: 1 };
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          records.delete(keyFor(where.userId, where.provider));
          return { count: 1 };
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return [...records.values()].filter((record) => record.userId === where.userId);
        }),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockState.prisma,
}));

vi.mock("@/lib/crypto/vault", () => ({
  encrypt: vi.fn((value: string) => ({
    encrypted: `encrypted:${value}`,
    nonce: "nonce-1",
  })),
  decrypt: vi.fn((encrypted: string) => encrypted.replace(/^encrypted:/, "")),
}));

import { prisma } from "@/lib/prisma";
import {
  getUserApiKey,
  invalidateUserApiKey,
  storeUserApiKey,
} from "@/lib/services/user-api-keys";

describe("user-api-keys", () => {
  beforeEach(() => {
    mockState.records.clear();
    vi.clearAllMocks();
  });

  it("storing a key encrypts it", async () => {
    await storeUserApiKey("user-1", "CLAUDE_API", "sk-ant-test-123456");

    const record = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId: "user-1", provider: "CLAUDE_API" } },
    });

    expect(record?.encryptedKey).toBe("encrypted:sk-ant-test-123456");
    expect(record?.encryptedKey).not.toBe("sk-ant-test-123456");
  });

  it("retrieving decrypts correctly", async () => {
    await storeUserApiKey("user-1", "OPENAI_API", "sk-test-123456");

    await expect(getUserApiKey("user-1", "OPENAI_API")).resolves.toBe("sk-test-123456");
  });

  it("invalid key format throws an error", async () => {
    await expect(storeUserApiKey("user-1", "CLAUDE_API", "bad-key")).rejects.toThrow(/Invalid Anthropic API key format/i);
  });

  it("invalidated key returns null", async () => {
    await storeUserApiKey("user-1", "OPENAI_API", "sk-test-123456");
    await invalidateUserApiKey("user-1", "OPENAI_API");

    await expect(getUserApiKey("user-1", "OPENAI_API")).resolves.toBeNull();
  });

  it("upsert replaces an existing key", async () => {
    const first = await storeUserApiKey("user-1", "OPENAI_API", "sk-test-123456");
    const second = await storeUserApiKey("user-1", "OPENAI_API", "sk-test-abcdef");
    const resolved = await getUserApiKey("user-1", "OPENAI_API");

    expect(first.keyPrefix).toBe("sk-test-12...");
    expect(second.keyPrefix).toBe("sk-test-ab...");
    expect(resolved).toBe("sk-test-abcdef");
  });
});
