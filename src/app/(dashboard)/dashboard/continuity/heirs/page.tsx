"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HeirCard } from "@/components/continuity/HeirCard";
import { HeirForm } from "@/components/continuity/HeirForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HeirDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function ContinuityHeirsPage() {
  const [heirs, setHeirs] = useState<HeirDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingHeir, setEditingHeir] = useState<HeirDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadHeirs() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/continuity/heirs");
      const payload = (await response.json()) as { success: boolean; data?: HeirDTO[]; error?: string };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load heirs.");
      }

      setHeirs(payload.data);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load heirs.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHeirs();
  }, []);

  async function saveHeir(values: {
    id?: string;
    fullName: string;
    email: string;
    phone: string;
    relationship: string;
    accessLevel: string;
    instructions: string;
  }) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/continuity/heirs", {
        method: values.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          notificationOrder: editingHeir?.notificationOrder ?? heirs.length + 1,
        }),
      });
      const payload = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to save heir.");
      }

      toast.success(values.id ? "Heir updated." : "Heir added and verification email sent.");
      setDialogOpen(false);
      setEditingHeir(null);
      await loadHeirs();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to save heir.";
      toast.error(message);
      throw caughtError;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteHeir(id: string) {
    try {
      const response = await fetch(`/api/continuity/heirs?id=${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete heir.");
      }

      toast.success("Heir removed.");
      await loadHeirs();
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Unable to delete heir.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Continuity"
        title="Infrastructure heirs"
        description="Define who gets contacted first, what level of access they receive, and what you need them to do."
        action={
          <Button type="button" onClick={() => { setEditingHeir(null); setDialogOpen(true); }} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
            Add Heir
          </Button>
        }
      />

      {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}

      {isLoading ? (
        <div className="panel-card p-6 text-sm text-[var(--text-secondary)]">Loading heirs...</div>
      ) : heirs.length === 0 ? (
        <EmptyState title="No heirs configured yet" description="Add the people who should keep the business alive, shut it down safely, or hand it to counsel." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {heirs.map((heir) => (
            <HeirCard
              key={heir.id}
              heir={heir}
              onDelete={deleteHeir}
              onEdit={(selectedHeir) => {
                setEditingHeir(selectedHeir);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{editingHeir ? "Edit heir" : "Add heir"}</DialogTitle>
          </DialogHeader>
          <HeirForm
            key={editingHeir?.id ?? "new-heir"}
            initialValue={editingHeir}
            isSaving={isSaving}
            notificationOrder={heirs.length + 1}
            onCancel={() => setDialogOpen(false)}
            onSubmit={saveHeir}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
