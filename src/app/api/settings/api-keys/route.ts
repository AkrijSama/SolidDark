import { NextRequest, NextResponse } from "next/server";
import type { AIProvider } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { deleteUserApiKey, listUserApiKeys, storeUserApiKey } from "@/lib/services/user-api-keys";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const keys = await listUserApiKeys(user.id);
    return NextResponse.json({ keys });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load API keys." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { provider, apiKey } = (await request.json()) as {
      provider?: string;
      apiKey?: string;
    };

    if (!provider || !apiKey) {
      return NextResponse.json({ error: "provider and apiKey required" }, { status: 400 });
    }

    if (!["CLAUDE_API", "OPENAI_API"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const result = await storeUserApiKey(user.id, provider as AIProvider, apiKey);
    return NextResponse.json({ message: "API key stored", keyPrefix: result.keyPrefix });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to store API key." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { provider } = (await request.json()) as { provider?: string };

    if (!provider || !["CLAUDE_API", "OPENAI_API"].includes(provider)) {
      return NextResponse.json({ error: "Valid provider required" }, { status: 400 });
    }

    await deleteUserApiKey(user.id, provider as AIProvider);
    return NextResponse.json({ message: "API key removed" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove API key." },
      { status: 500 },
    );
  }
}
