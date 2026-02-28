"use client";

import { useEffect, useState } from "react";

import { SOUL_FIRST_MESSAGE } from "@/lib/constants";
import type { SoulMessageDTO } from "@/lib/types";

type ConversationState = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: SoulMessageDTO[];
};

function createInitialMessage(): SoulMessageDTO {
  return {
    id: "soul-first-message",
    role: "ASSISTANT",
    content: SOUL_FIRST_MESSAGE,
    model: "SolidDark Soul",
    jurisdictions: [],
    createdAt: new Date().toISOString(),
  };
}

export function useSoul() {
  const [conversations, setConversations] = useState<ConversationState[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SoulMessageDTO[]>([createInitialMessage()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadConversations() {
      try {
        const response = await fetch("/api/soul/chat");
        const payload = (await response.json()) as { success: boolean; data?: ConversationState[]; error?: string };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to load conversations.");
        }

        if (mounted) {
          setConversations(payload.data);
          if (payload.data[0]) {
            setActiveConversationId(payload.data[0].id);
            setMessages(payload.data[0].messages.length > 0 ? payload.data[0].messages : [createInitialMessage()]);
          }
        }
      } catch (caughtError) {
        if (mounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load conversations.");
        }
      }
    }

    void loadConversations();

    return () => {
      mounted = false;
    };
  }, []);

  async function sendMessage(content: string, model?: string) {
    const trimmed = content.trim();

    if (!trimmed) {
      setError("Enter a message before sending.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const userMessage: SoulMessageDTO = {
      id: crypto.randomUUID(),
      role: "USER",
      content: trimmed,
      model: model ?? null,
      jurisdictions: [],
      createdAt: new Date().toISOString(),
    };

    const assistantMessage: SoulMessageDTO = {
      id: crypto.randomUUID(),
      role: "ASSISTANT",
      content: "",
      model: model ?? null,
      jurisdictions: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/soul/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: activeConversationId ?? undefined,
          message: trimmed,
          model,
        }),
      });

      if (!response.ok || !response.body) {
        const responseText = await response.text();
        throw new Error(responseText || "Soul chat request failed.");
      }

      const conversationId = response.headers.get("X-Conversation-Id");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? {
                  ...message,
                  content: fullResponse,
                  model: model ?? "Soul response",
                }
              : message,
          ),
        );
      }

      if (conversationId) {
        setActiveConversationId(conversationId);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Soul chat failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([createInitialMessage()]);
    setError(null);
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;

  return {
    activeConversation,
    conversations,
    error,
    isLoading,
    messages,
    sendMessage,
    setActiveConversationId,
    setMessages,
    startNewConversation,
  };
}
