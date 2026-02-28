import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { User } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase server client is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookieValues) {
        for (const cookie of cookieValues) {
          cookieStore.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
}

export async function requireAuthenticatedAppUser() {
  const supabase = await createSupabaseServerClient();
  const prisma = getPrismaClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Failed to load authenticated Supabase user: ${error.message}`);
  }

  if (!authUser) {
    throw new Error("You must be logged in to access this resource.");
  }

  const user = await prisma.user.findUnique({
    where: {
      supabaseId: authUser.id,
    },
  });

  if (user) {
    return {
      authUser,
      user,
    };
  }

  try {
    const syncedUser = await upsertAppUserFromSupabase(authUser);

    return {
      authUser,
      user: syncedUser,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`SolidDark could not create a matching user record for this account: ${message}`);
  }
}

export async function upsertAppUserFromSupabase(authUser: SupabaseUser): Promise<User> {
  const prisma = getPrismaClient();

  return prisma.user.upsert({
    where: {
      supabaseId: authUser.id,
    },
    update: {
      email: authUser.email ?? "",
      fullName: authUser.user_metadata.full_name ?? authUser.user_metadata.name ?? null,
      avatarUrl: authUser.user_metadata.avatar_url ?? null,
    },
    create: {
      email: authUser.email ?? "",
      fullName: authUser.user_metadata.full_name ?? authUser.user_metadata.name ?? null,
      avatarUrl: authUser.user_metadata.avatar_url ?? null,
      supabaseId: authUser.id,
    },
  });
}

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin client is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
