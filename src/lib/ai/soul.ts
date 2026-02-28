import type { AIProvider } from "@prisma/client";

import { sendMessage, type ProviderMessage } from "@/lib/ai/providers";
import { SOUL_SYSTEM_PROMPT } from "@/lib/ai/prompts/soul-system";

type SoulInput = {
  history: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; content: string }>;
  message: string;
  jurisdictions: string[];
  provider: AIProvider;
  model: string;
  localLlmUrl?: string | null;
};

export function getSoulSystemPrompt(jurisdictions: string[]) {
  return SOUL_SYSTEM_PROMPT.replace("{JURISDICTIONS}", jurisdictions.join(", "));
}

export function streamSoulResponse({ history, message, jurisdictions, provider, model, localLlmUrl }: SoulInput) {
  const messages: ProviderMessage[] = [
    {
      role: "system",
      content: getSoulSystemPrompt(jurisdictions),
    },
    ...history.map<ProviderMessage>((item) => {
      const role: ProviderMessage["role"] =
        item.role === "ASSISTANT"
          ? "assistant"
          : item.role === "SYSTEM"
            ? "system"
            : "user";

      return {
        role,
        content: item.content,
      };
    }),
    {
      role: "user",
      content: message,
    },
  ];

  return sendMessage(messages, provider, model, {
    localLlmUrl,
    maxTokens: 1500,
    temperature: 0.25,
  });
}
