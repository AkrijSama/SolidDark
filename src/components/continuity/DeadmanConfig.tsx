"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEADMAN_GRACE_OPTIONS, DEADMAN_INTERVAL_OPTIONS } from "@/lib/constants";
import type { DeadmanDTO } from "@/lib/types";

export function DeadmanConfig() {
  const [config, setConfig] = useState<DeadmanDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/continuity/deadman");
        const payload = (await response.json()) as { success: boolean; data?: DeadmanDTO | null; error?: string };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Unable to load dead-man configuration.");
        }

        if (mounted) {
          setConfig(
            payload.data ?? {
              id: "new",
              isEnabled: false,
              checkIntervalHours: 72,
              lastCheckIn: new Date().toISOString(),
              gracePeriodHours: 24,
              escalationStage: 0,
              alertEmail: true,
              alertSms: false,
              alertPhone: null,
            },
          );
        }
      } catch (caughtError) {
        if (mounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load dead-man configuration.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      mounted = false;
    };
  }, []);

  async function saveConfig() {
    if (!config) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/continuity/deadman", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      const payload = (await response.json()) as { success: boolean; data?: DeadmanDTO; error?: string };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to save dead-man configuration.");
      }

      setConfig(payload.data);
      toast.success("Dead-man configuration saved.");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to save dead-man configuration.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function checkInNow() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/continuity/deadman/check-in", {
        method: "POST",
      });
      const payload = (await response.json()) as { success: boolean; data?: { lastCheckIn: string; escalationStage: number }; error?: string };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to record check-in.");
      }

      setConfig((current) =>
        current
          ? {
              ...current,
              lastCheckIn: payload.data!.lastCheckIn,
              escalationStage: payload.data!.escalationStage,
            }
          : current,
      );
      toast.success("Check-in recorded.");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to record check-in.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !config) {
    return <div className="panel-card p-6 text-sm text-[var(--text-secondary)]">Loading dead-man configuration...</div>;
  }

  return (
    <div className="panel-card space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Dead-man&apos;s switch</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            If you stop checking in, SolidDark escalates from a warning email to heir notifications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="deadman-enabled">Enabled</Label>
          <Switch id="deadman-enabled" checked={config.isEnabled} onCheckedChange={(isEnabled) => setConfig((current) => (current ? { ...current, isEnabled } : current))} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Check-in interval</Label>
          <Select value={String(config.checkIntervalHours)} onValueChange={(value) => setConfig((current) => (current ? { ...current, checkIntervalHours: Number(value) } : current))}>
            <SelectTrigger className="field-base border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              {DEADMAN_INTERVAL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Grace period</Label>
          <Select value={String(config.gracePeriodHours)} onValueChange={(value) => setConfig((current) => (current ? { ...current, gracePeriodHours: Number(value) } : current))}>
            <SelectTrigger className="field-base border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              {DEADMAN_GRACE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Email alerts</p>
              <p className="text-sm text-[var(--text-secondary)]">Warn you before heirs are notified.</p>
            </div>
            <Switch checked={config.alertEmail} onCheckedChange={(alertEmail) => setConfig((current) => (current ? { ...current, alertEmail } : current))} />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">SMS alerts</p>
              <p className="text-sm text-[var(--text-secondary)]">Tracked now. Delivery is not wired yet in this build.</p>
            </div>
            <Switch checked={config.alertSms} onCheckedChange={(alertSms) => setConfig((current) => (current ? { ...current, alertSms } : current))} />
          </div>
          {config.alertSms ? (
            <div className="mt-4 space-y-2">
              <Label htmlFor="deadman-phone">Phone</Label>
              <Input id="deadman-phone" value={config.alertPhone ?? ""} onChange={(event) => setConfig((current) => (current ? { ...current, alertPhone: event.target.value } : current))} className="field-base" placeholder="+1 555 555 5555" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 text-sm text-[var(--text-secondary)]">
        <p>Last check-in: {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(config.lastCheckIn))}</p>
        <p className="mt-2">Current escalation stage: {config.escalationStage}</p>
      </div>

      {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void checkInNow()} disabled={isSaving} className="bg-[var(--accent-red)] px-6 text-white hover:bg-[var(--accent-red)]/90">
          CHECK IN NOW
        </Button>
        <Button type="button" variant="outline" onClick={() => void saveConfig()} disabled={isSaving} className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
          {isSaving ? "Saving..." : "Save configuration"}
        </Button>
      </div>
    </div>
  );
}
