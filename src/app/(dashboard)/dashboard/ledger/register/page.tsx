"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RegisterForm } from "@/components/ledger/RegisterForm";
import { WorkEntryCard } from "@/components/ledger/WorkEntryCard";
import { PageHeader } from "@/components/shared/PageHeader";
import type { WorkEntryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function LedgerRegisterPage() {
  const [entries, setEntries] = useState<WorkEntryDTO[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  async function loadEntries() {
    const response = await fetch("/api/ledger/register");
    const payload = (await response.json()) as { success: boolean; data?: WorkEntryDTO[]; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Unable to load work entries.");
    }
    setEntries(payload.data);
  }

  useEffect(() => {
    void loadEntries().catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load work entries."));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Ledger" title="Register work" description="Add a project, sign its evidence bundle, and store the signature in your ledger." />
      <RegisterForm
        isSaving={isSaving}
        onSubmit={async (values) => {
          setIsSaving(true);
          try {
            const metrics = values.metrics ? JSON.parse(values.metrics) : undefined;
            const response = await fetch("/api/ledger/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...values, metrics }),
            });
            const payload = (await response.json()) as { success: boolean; error?: string };
            if (!response.ok || !payload.success) {
              throw new Error(payload.error ?? "Unable to register work.");
            }
            toast.success("Work entry registered.");
            await loadEntries();
          } finally {
            setIsSaving(false);
          }
        }}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {entries.map((entry) => (
          <WorkEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
