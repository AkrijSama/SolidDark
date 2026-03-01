export const SOUL_RATE_LIMITS: Record<string, { messagesPerDay: number; label: string }> = {
  FREE: { messagesPerDay: 10, label: "10 messages/day" },
  STARTER: { messagesPerDay: 200, label: "200 messages/day" },
  GROWTH: { messagesPerDay: 500, label: "500 messages/day" },
  PROFESSIONAL: { messagesPerDay: 9_999_999, label: "Unlimited" },
  ENTERPRISE: { messagesPerDay: 9_999_999, label: "Unlimited" },
};

export const BYOK_UNLIMITED = true;

export const ESTIMATED_COST_PER_MESSAGE_CENTS = {
  "claude-opus-4-6": 8,
  "claude-sonnet-4-5-20250929": 2,
  "gpt-4o": 3,
  local: 0,
} as const;

export type ModelId = keyof typeof ESTIMATED_COST_PER_MESSAGE_CENTS;
