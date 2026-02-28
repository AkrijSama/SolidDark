import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

function createLoginRedirect(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
  return NextResponse.redirect(redirectUrl);
}

function isMissingAuthSession(error: unknown) {
  return error instanceof Error && /auth session missing/i.test(error.message);
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return response;
  }

  try {
    const supabase = createSupabaseMiddlewareClient(request, response);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (isMissingAuthSession(error)) {
        return createLoginRedirect(request);
      }

      throw error;
    }

    if (!user) {
      return createLoginRedirect(request);
    }

    return response;
  } catch (error) {
    if (isMissingAuthSession(error)) {
      return createLoginRedirect(request);
    }

    console.error("Proxy auth check failed.", error);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "auth-check-failed");
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
