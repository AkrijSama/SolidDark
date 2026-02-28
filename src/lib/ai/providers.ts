import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

import type { AIProvider } from "@prisma/client";

import { createApiError, getRequiredEnv } from "@/lib/utils";

export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderOptions = {
  maxTokens?: number;
  temperature?: number;
  localLlmUrl?: string | null;
};

const encoder = new TextEncoder();

function streamFromIterator(iterator: AsyncGenerator<string, void, void>) {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();

        if (done) {
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      if (typeof iterator.return === "function") {
        await iterator.return();
      }
    },
  });
}

async function* streamAnthropic(messages: ProviderMessage[], model: string, options?: ProviderOptions) {
  try {
    const client = new Anthropic({
      apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    });

    const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content);
    const userMessages: MessageParam[] = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));

    const stream = await client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 1200,
      temperature: options?.temperature ?? 0.3,
      system: systemMessages.join("\n\n"),
      messages: userMessages,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  } catch (error) {
    yield `SolidDark encountered an Anthropic streaming error: ${createApiError(error, "Unknown Anthropic error.")}`;
  }
}

async function* streamOpenAI(messages: ProviderMessage[], model: string, options?: ProviderOptions) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getRequiredEnv("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 1200,
        messages,
      }),
    });

    if (!response.ok || !response.body) {
      const responseText = await response.text();
      throw new Error(`OpenAI request failed with status ${response.status}: ${responseText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }

        const payload = trimmed.replace(/^data:\s*/, "");
        if (payload === "[DONE]") {
          return;
        }

        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const chunk = parsed.choices?.[0]?.delta?.content;

        if (chunk) {
          yield chunk;
        }
      }
    }
  } catch (error) {
    yield `SolidDark encountered an OpenAI streaming error: ${createApiError(error, "Unknown OpenAI error.")}`;
  }
}

async function* streamLocalLlm(messages: ProviderMessage[], model: string, options?: ProviderOptions) {
  try {
    const baseUrl = options?.localLlmUrl ?? process.env.LOCAL_LLM_URL ?? "http://localhost:11434";
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages,
      }),
    });

    if (!response.ok || !response.body) {
      const responseText = await response.text();
      throw new Error(`Local LLM request failed with status ${response.status}: ${responseText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const parsed = JSON.parse(line) as { message?: { content?: string } };
        const chunk = parsed.message?.content;

        if (chunk) {
          yield chunk;
        }
      }
    }
  } catch (error) {
    yield `SolidDark encountered a local LLM streaming error: ${createApiError(error, "Unknown local LLM error.")}`;
  }
}

export function sendMessage(messages: ProviderMessage[], provider: AIProvider, model: string, options?: ProviderOptions) {
  const iterator =
    provider === "OPENAI_API"
      ? streamOpenAI(messages, model, options)
      : provider === "LOCAL_LLM"
        ? streamLocalLlm(messages, model, options)
        : streamAnthropic(messages, model, options);

  return streamFromIterator(iterator);
}
