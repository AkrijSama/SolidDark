"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { VaultEntryDetail, VaultEntrySummary } from "@/lib/types";

type VaultInput = {
  id?: string;
  serviceName: string;
  serviceType: string;
  username?: string;
  password?: string;
  apiKey?: string;
  notes?: string;
  expiresAt?: string | null;
  accessibleBy: string[];
};

export function useVault() {
  const [entries, setEntries] = useState<VaultEntrySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/continuity/vault");
      const payload = (await response.json()) as {
        success: boolean;
        data?: VaultEntrySummary[];
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load vault entries.");
      }

      setEntries(payload.data);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load vault entries.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const revealEntry = useCallback(async (entryId: string) => {
    const response = await fetch(`/api/continuity/vault?entryId=${entryId}&reveal=true`);
    const payload = (await response.json()) as {
      success: boolean;
      data?: VaultEntryDetail;
      error?: string;
    };

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Unable to reveal vault entry.");
    }

    return payload.data;
  }, []);

  const saveEntry = useCallback(
    async (input: VaultInput) => {
      setIsSaving(true);
      setError(null);

      try {
        const method = input.id ? "PUT" : "POST";
        const response = await fetch("/api/continuity/vault", {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });

        const payload = (await response.json()) as {
          success: boolean;
          data?: VaultEntrySummary;
          error?: string;
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to save vault entry.");
        }

        toast.success(input.id ? "Credential updated." : "Credential saved.");
        await loadEntries();
        return payload.data;
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Unable to save vault entry.";
        setError(message);
        toast.error(message);
        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [loadEntries],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      setError(null);

      try {
        const response = await fetch(`/api/continuity/vault?id=${entryId}`, {
          method: "DELETE",
        });
        const payload = (await response.json()) as { success: boolean; error?: string };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Unable to delete vault entry.");
        }

        toast.success("Credential deleted.");
        await loadEntries();
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Unable to delete vault entry.";
        setError(message);
        toast.error(message);
        throw caughtError;
      }
    },
    [loadEntries],
  );

  return {
    deleteEntry,
    entries,
    error,
    isLoading,
    isSaving,
    loadEntries,
    revealEntry,
    saveEntry,
  };
}
