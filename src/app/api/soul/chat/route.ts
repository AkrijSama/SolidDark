import type { NextRequest } from "next/server";

import { streamSoulResponse } from "@/lib/ai/soul";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/utils";

const encoder = new TextEncoder();

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const userWithConversations = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      include: {
        soulConversations: {
          orderBy: {
            updatedAt: "desc",
          },
          include: {
            messages: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
    });

    if (!userWithConversations) {
      return jsonError("SolidDark could not find your user record.", 404);
    }

    return jsonOk(
      userWithConversations.soulConversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          model: message.model,
          jurisdictions: message.jurisdictions,
          createdAt: message.createdAt.toISOString(),
        })),
      })),
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load conversations.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      conversationId?: string;
      message?: string;
      model?: string;
    };

    if (!body.message?.trim()) {
      return jsonError("Message is required.", 400);
    }

    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const conversation = body.conversationId
      ? await prisma.soulConversation.findFirst({
          where: {
            id: body.conversationId,
            userId: user.id,
          },
          include: {
            messages: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        })
      : await prisma.soulConversation.create({
          data: {
            userId: user.id,
            title: body.message.slice(0, 60),
          },
          include: {
            messages: true,
          },
        });

    if (!conversation) {
      return jsonError("Conversation not found.", 404);
    }

    await prisma.soulMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: body.message,
        model: body.model ?? null,
        jurisdictions: user.jurisdictions,
      },
    });

    const provider = user.aiProvider;
    const model =
      body.model ??
      (provider === "OPENAI_API"
        ? "gpt-4o"
        : provider === "LOCAL_LLM"
          ? "llama3.1"
          : "claude-sonnet-4-5-20250929");

    const stream = streamSoulResponse({
      history: conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      message: body.message,
      jurisdictions: user.jurisdictions,
      provider,
      model,
      localLlmUrl: user.localLlmUrl,
    });

    const [clientStream, captureStream] = stream.tee();

    void (async () => {
      const reader = captureStream.getReader();
      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        content += decoder.decode(value, { stream: true });
      }

      const finalContent = content.trim() || "SolidDark encountered an empty response from the provider.";

      await prisma.soulMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: finalContent,
          model,
          jurisdictions: user.jurisdictions,
        },
      });
    })().catch((error) => {
      console.error("Failed to store Soul assistant message.", error);
    });

    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Conversation-Id": conversation.id,
      },
    });
  } catch (error) {
    return new Response(encoder.encode(error instanceof Error ? error.message : "Soul chat failed."), {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
