"use client";

import { useEffect, useState } from "react";

import type { SubscriptionTier } from "@prisma/client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useSubscription() {
  const [tier, setTier] = useState<SubscriptionTier>("FREE");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTier() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: authError } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!data.user) {
          throw new Error("You must be logged in to load subscription details.");
        }

        const response = await fetch("/api/stripe/portal", { method: "GET" });
        const payload = (await response.json()) as { success: boolean; data?: { tier: SubscriptionTier }; error?: string };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to load subscription details.");
        }

        if (mounted) {
          setTier(payload.data.tier);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load subscription details.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTier();

    return () => {
      mounted = false;
    };
  }, []);

  return { tier, isLoading, error };
}
