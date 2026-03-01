import type { AIProvider } from "@prisma/client";

import { sendMessage, type ProviderMessage } from "@/lib/ai/providers";
import { SOUL_SYSTEM_PROMPT } from "@/lib/ai/prompts/soul-system";

type SoulInput = {
  history: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; content: string }>;
  message: string;
  jurisdictions: string[];
  provider: AIProvider;
  model: string;
  apiKey?: string;
  localLlmUrl?: string | null;
};

export function getSoulSystemPrompt(jurisdictions: string[]) {
  return SOUL_SYSTEM_PROMPT.replace("{JURISDICTIONS}", jurisdictions.join(", "));
}

export function streamSoulResponse({ history, message, jurisdictions, provider, model, apiKey, localLlmUrl }: SoulInput) {
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

  const options = {
    localLlmUrl,
    maxTokens: 1500,
    temperature: 0.25,
  };

  return apiKey ? sendMessage(messages, provider, model, apiKey, options) : sendMessage(messages, provider, model, options);
}

type HandleSoulMessageInput = {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  jurisdictions: string[];
  provider: AIProvider;
  model: string;
  apiKey: string;
  localLlmUrl?: string;
};

export function handleSoulMessage({
  messages,
  jurisdictions,
  provider,
  model,
  apiKey,
  localLlmUrl,
}: HandleSoulMessageInput) {
  const history = messages
    .slice(0, Math.max(0, messages.length - 1))
    .map<SoulInput["history"][number]>((message) => ({
      role: message.role === "assistant" ? "ASSISTANT" : message.role === "system" ? "SYSTEM" : "USER",
      content: message.content,
    }));

  const latestMessage = messages[messages.length - 1];

  if (!latestMessage) {
    throw new Error("handleSoulMessage requires at least one message.");
  }

  return streamSoulResponse({
    history,
    message: latestMessage.content,
    jurisdictions,
    provider,
    model,
    apiKey,
    localLlmUrl: localLlmUrl ?? null,
  });
}
