import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { upsertAppUserFromSupabase } from "@/lib/supabase/server";
import { createApiError } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Supabase session sync is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        accessToken?: string;
        refreshToken?: string;
      }
    | null;

  if (!body?.accessToken || !body.refreshToken) {
    return NextResponse.json(
      {
        success: false,
        error: "Access token and refresh token are required.",
      },
      { status: 400 },
    );
  }

  const pendingCookies: Parameters<NextResponse["cookies"]["set"]>[] = [];

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookieValues) {
          for (const cookie of cookieValues) {
            pendingCookies.push([cookie.name, cookie.value, cookie.options]);
          }
        },
      },
    });

    const { data, error } = await supabase.auth.setSession({
      access_token: body.accessToken,
      refresh_token: body.refreshToken,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("Session sync completed without an authenticated user.");
    }

    const user = await upsertAppUserFromSupabase(data.user);
    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        supabaseId: user.supabaseId,
      },
    });

    for (const cookie of pendingCookies) {
      response.cookies.set(...cookie);
    }

    return response;
  } catch (error) {
    console.error("Unable to sync authenticated session.", error);

    return NextResponse.json(
      {
        success: false,
        error: createApiError(error, "Unable to sync the authenticated session."),
      },
      { status: 500 },
    );
  }
}
