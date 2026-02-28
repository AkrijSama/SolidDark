import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@prisma/client";

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(() => {
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("Mock Soul response."));
        controller.close();
      },
    });
  }),
}));

vi.mock("@/lib/ai/providers", () => ({
  sendMessage: sendMessageMock,
}));

import { getSoulSystemPrompt, streamSoulResponse } from "@/lib/ai/soul";

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    output += decoder.decode(value, { stream: true });
  }

  return output;
}

describe("Soul prompt handling", () => {
  beforeEach(() => {
    sendMessageMock.mockClear();
  });

  it("replaces the jurisdiction placeholder in the system prompt", () => {
    const prompt = getSoulSystemPrompt(["US-FL", "EU-DE"]);

    expect(prompt).toContain("US-FL, EU-DE");
    expect(prompt).not.toContain("{JURISDICTIONS}");
  });

  it("injects the system prompt and maps conversation history before sending", async () => {
    const stream = streamSoulResponse({
      history: [
        { role: "USER", content: "What document do I need?" },
        { role: "ASSISTANT", content: "Tell me your jurisdiction." },
        { role: "SYSTEM", content: "Internal note" },
      ],
      message: "I operate in Florida.",
      jurisdictions: ["US-FL"],
      provider: "CLAUDE_API" as AIProvider,
      model: "claude-sonnet-4-5-20250929",
      localLlmUrl: null,
    });

    expect(await readStream(stream)).toBe("Mock Soul response.");
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    const [messages, provider, model, options] = sendMessageMock.mock.calls[0] as unknown as [
      Array<{ role: string; content: string }>,
      AIProvider,
      string,
      { localLlmUrl?: string | null; maxTokens?: number; temperature?: number },
    ];

    expect(provider).toBe("CLAUDE_API");
    expect(model).toBe("claude-sonnet-4-5-20250929");
    expect(options).toMatchObject({
      maxTokens: 1500,
      temperature: 0.25,
      localLlmUrl: null,
    });
    expect(messages[0]).toMatchObject({
      role: "system",
    });
    expect(messages[0].content).toContain("US-FL");
    expect(messages[1]).toEqual({ role: "user", content: "What document do I need?" });
    expect(messages[2]).toEqual({ role: "assistant", content: "Tell me your jurisdiction." });
    expect(messages[3]).toEqual({ role: "system", content: "Internal note" });
    expect(messages[4]).toEqual({ role: "user", content: "I operate in Florida." });
  });
});
