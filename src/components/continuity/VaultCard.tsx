"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";

import { EncryptedBadge } from "@/components/shared/EncryptedBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils";
import type { VaultEntryDetail, VaultEntrySummary } from "@/lib/types";

type VaultCardProps = {
  accountEmail: string;
  entry: VaultEntrySummary;
  onDelete: (id: string) => Promise<void>;
  onEdit: (detail: VaultEntryDetail) => void;
  onReveal: (id: string) => Promise<VaultEntryDetail>;
};

export function VaultCard({ accountEmail, entry, onDelete, onEdit, onReveal }: VaultCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [detail, setDetail] = useState<VaultEntryDetail | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<"view" | "edit">("view");

  async function handleReveal() {
    setIsBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: accountEmail,
        password,
      });

      if (authError) {
        throw authError;
      }

      const revealed = await onReveal(entry.id);
      if (intent === "edit") {
        onEdit(revealed);
        setDialogOpen(false);
      } else {
        setDetail(revealed);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to reveal credential.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <div className="panel-card flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-xl font-semibold">{entry.serviceName}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{entry.serviceType.replaceAll("_", " ")}</p>
          </div>
          <EncryptedBadge />
        </div>
        <div className="grid gap-2 text-sm text-[var(--text-secondary)]">
          <p>Last rotated: {formatRelativeDate(entry.lastRotated)}</p>
          <p>Expires: {formatRelativeDate(entry.expiresAt)}</p>
          <p>Accessible by {entry.accessibleBy.length} heir(s)</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button type="button" onClick={() => { setIntent("view"); setDetail(null); setPassword(""); setError(null); setDialogOpen(true); }} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
            <Eye className="mr-2 h-4 w-4" />
            Reveal
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => { setIntent("edit"); setDetail(null); setPassword(""); setError(null); setDialogOpen(true); }}
            className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void onDelete(entry.id)}
            className="border-[var(--accent-red)]/40 bg-transparent text-[var(--accent-red)]"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{intent === "edit" ? `Unlock ${entry.serviceName} for editing` : `Reveal ${entry.serviceName}`}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-[var(--text-tertiary)]">Username</p>
                <p className="font-mono">{detail.data.username || "Not stored"}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-[var(--text-tertiary)]">Password</p>
                <p className="font-mono">{detail.data.password || "Not stored"}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-[var(--text-tertiary)]">API Key</p>
                <p className="font-mono break-all">{detail.data.apiKey || "Not stored"}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-[var(--text-tertiary)]">Notes</p>
                <p>{detail.data.notes || "No notes."}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Re-enter your account password before SolidDark decrypts this credential.
              </p>
              <div className="space-y-2">
                <Label htmlFor={`vault-password-${entry.id}`}>Current account password</Label>
                <Input
                  id={`vault-password-${entry.id}`}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field-base"
                />
              </div>
              {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}
              <Button type="button" disabled={isBusy || !password} onClick={() => void handleReveal()} className="w-full bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
                {isBusy ? "Verifying..." : "Re-authenticate and reveal"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
