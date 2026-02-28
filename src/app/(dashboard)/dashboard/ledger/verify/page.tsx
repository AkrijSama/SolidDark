"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { VerificationBadge } from "@/components/ledger/VerificationBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import type { WorkEntryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function LedgerVerifyPage() {
  const [entries, setEntries] = useState<WorkEntryDTO[]>([]);

  async function loadEntries() {
    const response = await fetch("/api/ledger/register");
    const payload = (await response.json()) as { success: boolean; data?: WorkEntryDTO[]; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Unable to load entries.");
    }
    setEntries(payload.data);
  }

  const handleInitialLoad = useEffectEvent(async () => {
    try {
      await loadEntries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load entries.");
    }
  });

  useEffect(() => {
    void handleInitialLoad();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Ledger" title="Verify entries" description="Re-run signature verification and mark entries verified when the evidence still matches." />
      <div className="grid gap-4">
        {entries.map((entry) => (
          <div key={entry.id} className="panel-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold">{entry.projectName}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{entry.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <VerificationBadge status={entry.status} />
              <Button
                type="button"
                onClick={async () => {
                  const verifyResponse = await fetch(`/api/ledger/verify?id=${entry.id}`);
                  const verifyPayload = (await verifyResponse.json()) as { success: boolean; data?: { signatureValid: boolean }; error?: string };
                  if (!verifyResponse.ok || !verifyPayload.success || !verifyPayload.data) {
                    toast.error(verifyPayload.error ?? "Unable to verify signature.");
                    return;
                  }
                  if (!verifyPayload.data.signatureValid) {
                    toast.error("Signature verification failed.");
                    return;
                  }
                  const response = await fetch("/api/ledger/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: entry.id, verificationMethod: "manual" }),
                  });
                  const payload = (await response.json()) as { success: boolean; error?: string };
                  if (!response.ok || !payload.success) {
                    toast.error(payload.error ?? "Unable to mark entry verified.");
                    return;
                  }
                  toast.success("Entry verified.");
                  await loadEntries();
                }}
                className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90"
              >
                Verify now
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
