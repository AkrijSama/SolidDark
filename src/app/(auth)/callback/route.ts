import { NextResponse } from "next/server";

import { createSupabaseServerClient, upsertAppUserFromSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing-oauth-code", url.origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("OAuth callback completed without a user session.");
    }

    await upsertAppUserFromSupabase(data.user);

    return NextResponse.redirect(new URL(nextPath, url.origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth sign-in failed.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));
  }
}
