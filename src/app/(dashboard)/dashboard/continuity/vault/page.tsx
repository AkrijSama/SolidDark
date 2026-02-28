"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { VaultCard } from "@/components/continuity/VaultCard";
import { VaultForm } from "@/components/continuity/VaultForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/hooks/useVault";
import type { HeirDTO, VaultEntryDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function ContinuityVaultPage() {
  const { user } = useAuth();
  const { deleteEntry, entries, isLoading, isSaving, revealEntry, saveEntry } = useVault();
  const [heirs, setHeirs] = useState<HeirDTO[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntryDetail | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadHeirs() {
      try {
        const response = await fetch("/api/continuity/heirs");
        const payload = (await response.json()) as { success: boolean; data?: HeirDTO[]; error?: string };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to load heirs.");
        }

        if (mounted) {
          setHeirs(payload.data);
        }
      } catch (caughtError) {
        toast.error(caughtError instanceof Error ? caughtError.message : "Unable to load heirs.");
      }
    }

    void loadHeirs();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Continuity"
        title="Credential vault"
        description="Encrypted access records for the services your business cannot afford to lose."
        action={
          <Button type="button" onClick={() => { setEditingEntry(null); setDialogOpen(true); }} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
            Add Credential
          </Button>
        }
      />

      {isLoading ? (
        <div className="panel-card p-6 text-sm text-[var(--text-secondary)]">Loading credentials...</div>
      ) : entries.length === 0 ? (
        <EmptyState title="No credentials stored yet" description="Start with the systems that would lock you out of customers, production, money, or source code." ctaLabel="Add credential" ctaHref="/dashboard/continuity/vault" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {entries.map((entry) => (
            <VaultCard
              key={entry.id}
              accountEmail={user?.email ?? ""}
              entry={entry}
              onDelete={deleteEntry}
              onEdit={(detail) => {
                setEditingEntry(detail);
                setDialogOpen(true);
              }}
              onReveal={revealEntry}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{editingEntry ? "Edit credential" : "Add credential"}</DialogTitle>
          </DialogHeader>
          <VaultForm
            key={editingEntry?.id ?? "new-vault-entry"}
            heirs={heirs}
            initialValue={editingEntry}
            isSaving={isSaving}
            onCancel={() => setDialogOpen(false)}
            onSubmit={async (values) => {
              await saveEntry({
                ...values,
                expiresAt: values.expiresAt || null,
              });
              setDialogOpen(false);
              setEditingEntry(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
