import { NextRequest, NextResponse } from "next/server";

import { handleSoulMessage } from "@/lib/ai/soul";
import { ESTIMATED_COST_PER_MESSAGE_CENTS, type ModelId } from "@/lib/constants/rate-limits";
import { prisma } from "@/lib/prisma";
import { checkSoulRateLimit, recordSoulUsage } from "@/lib/services/rate-limiter";
import { getUserApiKey } from "@/lib/services/user-api-keys";
import { createSupabaseServerClient, requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/utils";

export async function GET() {
  try {
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
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: {
        id: true,
        subscriptionTier: true,
        aiProvider: true,
        jurisdictions: true,
        localLlmUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      conversationId?: string;
      message?: string;
      model?: string;
    };
    const { conversationId, message, model } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const provider = user.aiProvider;
    let apiKey: string | null = null;
    let usingUserKey = false;

    if (provider === "LOCAL_LLM") {
      apiKey = "not-needed";
      usingUserKey = true;
    } else {
      const userKey = await getUserApiKey(user.id, provider);

      if (userKey) {
        apiKey = userKey;
        usingUserKey = true;
      } else {
        apiKey = provider === "CLAUDE_API" ? process.env.ANTHROPIC_API_KEY || null : process.env.OPENAI_API_KEY || null;

        if (!apiKey) {
          return NextResponse.json(
            {
              error: `No API key available for ${provider}. Add your own key in Settings → AI Configuration.`,
            },
            { status: 422 },
          );
        }
      }
    }

    const rateLimit = await checkSoulRateLimit(user.id, user.subscriptionTier, usingUserKey);

    if (!rateLimit.allowed) {
      const upgradeMsg =
        user.subscriptionTier === "FREE"
          ? "Upgrade to Starter ($49/mo) for 200 messages/day"
          : user.subscriptionTier === "STARTER"
            ? "Upgrade to Growth ($149/mo) for 500 messages/day"
            : "Add your own API key in Settings → AI Configuration for unlimited access";

      return NextResponse.json(
        {
          error: "Daily message limit reached",
          rateLimit: {
            limit: rateLimit.limit,
            remaining: 0,
            resetAt: rateLimit.resetAt,
            upgrade: upgradeMsg,
          },
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetAt,
          },
        },
      );
    }

    let convoId = conversationId;

    if (!convoId) {
      const newConvo = await prisma.soulConversation.create({
        data: {
          userId: user.id,
          title: message.substring(0, 80) + (message.length > 80 ? "..." : ""),
        },
      });
      convoId = newConvo.id;
    }

    await prisma.soulMessage.create({
      data: {
        conversationId: convoId,
        role: "USER",
        content: message,
        jurisdictions: user.jurisdictions,
      },
    });

    const history = await prisma.soulMessage.findMany({
      where: { conversationId: convoId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const selectedModel =
      model || (provider === "CLAUDE_API" ? "claude-sonnet-4-5-20250929" : provider === "LOCAL_LLM" ? "llama3.1" : "gpt-4o");

    const stream = await handleSoulMessage({
      messages: history.map((entry) => ({
        role: entry.role.toLowerCase() as "user" | "assistant" | "system",
        content: entry.content,
      })),
      jurisdictions: user.jurisdictions,
      provider,
      model: selectedModel,
      apiKey: apiKey!,
      localLlmUrl: user.localLlmUrl || undefined,
    });

    let fullResponse = "";
    const decoder = new TextDecoder();

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        fullResponse += decoder.decode(chunk, { stream: true });
        controller.enqueue(chunk);
      },
      async flush() {
        fullResponse += decoder.decode();
        const finalContent = fullResponse.trim() || "SolidDark encountered an empty response from the provider.";
        const tokensIn = Math.ceil(message.length / 4);
        const tokensOut = Math.ceil(finalContent.length / 4);
        const costCents = ESTIMATED_COST_PER_MESSAGE_CENTS[selectedModel as ModelId] || 2;

        try {
          await prisma.soulMessage.create({
            data: {
              conversationId: convoId,
              role: "ASSISTANT",
              content: finalContent,
              model: selectedModel,
              jurisdictions: user.jurisdictions,
              tokensUsed: tokensIn + tokensOut,
            },
          });

          if (!usingUserKey) {
            await recordSoulUsage(user.id, tokensIn, tokensOut, costCents);
          }
        } catch (err) {
          console.error("Failed to save Soul response or record usage:", err);
        }
      },
    });

    const trackedStream = stream.pipeThrough(transformStream);

    return new Response(trackedStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(Math.max(0, rateLimit.remaining - 1)),
        "X-RateLimit-Reset": rateLimit.resetAt,
        "X-Using-Own-Key": String(usingUserKey),
        "X-Conversation-Id": convoId,
      },
    });
  } catch (error) {
    console.error("Soul chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process message" },
      { status: 500 },
    );
  }
}
