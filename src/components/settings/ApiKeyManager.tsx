"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type StoredKey = {
  id: string;
  provider: "CLAUDE_API" | "OPENAI_API";
  keyPrefix: string;
  isValid: boolean;
  lastUsed: string | null;
  lastValidated: string | null;
  createdAt: string;
};

type UsageResponse = {
  today: {
    messagesUsed: number;
    limit: number;
    remaining: number;
    limitLabel: string;
  };
  monthly: {
    totalMessages: number;
    estimatedCostCents: number;
    dailyBreakdown: Array<{ date: string; messages: number; costCents: number }>;
  };
  tier: "FREE" | "STARTER" | "GROWTH" | "PROFESSIONAL" | "ENTERPRISE";
  hasOwnApiKey: boolean;
};

const PROVIDERS = [
  {
    provider: "CLAUDE_API" as const,
    label: "Anthropic",
    placeholder: "sk-ant-...",
    helper: "Use your Anthropic key for unlimited Soul messages on Claude models.",
  },
  {
    provider: "OPENAI_API" as const,
    label: "OpenAI",
    placeholder: "sk-...",
    helper: "Use your OpenAI key for unlimited Soul messages on GPT models.",
  },
] as const;

export function ApiKeyManager() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({
    CLAUDE_API: "",
    OPENAI_API: "",
  });
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);

    try {
      const [keysResponse, usageResponse] = await Promise.all([
        fetch("/api/settings/api-keys", { cache: "no-store" }),
        fetch("/api/settings/usage", { cache: "no-store" }),
      ]);

      const keysPayload = (await keysResponse.json()) as { keys?: StoredKey[]; error?: string };
      const usagePayload = (await usageResponse.json()) as UsageResponse & { error?: string };

      if (!keysResponse.ok) {
        throw new Error(keysPayload.error ?? "Failed to load stored API keys.");
      }

      if (!usageResponse.ok) {
        throw new Error(usagePayload.error ?? "Failed to load usage.");
      }

      setKeys(keysPayload.keys ?? []);
      setUsage(usagePayload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load API key settings.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const keysByProvider = useMemo(() => {
    return new Map(keys.map((key) => [key.provider, key]));
  }, [keys]);

  const usagePercent = useMemo(() => {
    if (!usage) {
      return 0;
    }

    if (!Number.isFinite(usage.today.limit) || usage.today.limit > 1_000_000) {
      return 0;
    }

    return Math.min(100, Math.round((usage.today.messagesUsed / Math.max(1, usage.today.limit)) * 100));
  }, [usage]);

  async function saveKey(provider: "CLAUDE_API" | "OPENAI_API") {
    const apiKey = inputs[provider].trim();

    if (!apiKey) {
      toast.error("Paste an API key before saving.");
      return;
    }

    setBusyProvider(provider);

    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, apiKey }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to store API key.");
      }

      setInputs((current) => ({ ...current, [provider]: "" }));
      toast.success(payload.message ?? "API key stored.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to store API key.");
    } finally {
      setBusyProvider(null);
    }
  }

  async function removeKey(provider: "CLAUDE_API" | "OPENAI_API") {
    setBusyProvider(provider);

    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove API key.");
      }

      toast.success(payload.message ?? "API key removed.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove API key.");
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="panel-card space-y-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Your API keys</p>
        <h3 className="font-heading mt-2 text-2xl font-semibold">Bring your own key for unlimited Soul usage</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          Add your own API key for unlimited Soul messages. Your key is encrypted with the same vault crypto used elsewhere in SolidDark and is
          never shown in full after storage.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {PROVIDERS.map((item) => {
          const storedKey = keysByProvider.get(item.provider);
          const isBusy = busyProvider === item.provider;

          return (
            <div key={item.provider} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.helper}</p>
                </div>
                <KeyRound className="mt-1 h-5 w-5 text-[var(--accent-amber)]" />
              </div>

              {storedKey ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Active</Badge>
                    <span className="font-mono text-sm text-[var(--text-primary)]">{storedKey.keyPrefix}</span>
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {storedKey.lastUsed ? `Last used ${new Date(storedKey.lastUsed).toLocaleString()}` : "Stored and ready to use."}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void removeKey(item.provider)}
                    disabled={isBusy}
                    className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  >
                    {isBusy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                    Remove key
                  </Button>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <Input
                    value={inputs[item.provider]}
                    onChange={(event) =>
                      setInputs((current) => ({
                        ...current,
                        [item.provider]: event.target.value,
                      }))
                    }
                    placeholder={item.placeholder}
                    className="field-base"
                  />
                  <Button
                    type="button"
                    onClick={() => void saveKey(item.provider)}
                    disabled={isBusy}
                    className="bg-[var(--accent-red)] text-[var(--bg-primary)] hover:bg-[var(--accent-red)]/90"
                  >
                    {isBusy ? <LoaderCircle className="animate-spin" /> : null}
                    Save key
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Usage</p>
            <h4 className="mt-1 text-xl font-semibold">Soul usage this month</h4>
          </div>
          {usage ? (
            <Badge className="border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
              {usage.tier} plan
            </Badge>
          ) : null}
        </div>

        {isLoading ? (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading usage…</p>
        ) : usage ? (
          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--text-secondary)]">
                  {usage.today.messagesUsed} / {usage.today.limitLabel} used today
                </span>
                <span className="text-[var(--text-primary)]">
                  {usage.hasOwnApiKey ? "Using your own key" : `${usage.today.remaining} remaining`}
                </span>
              </div>
              <Progress value={usagePercent} className="mt-3 h-3 bg-[var(--bg-secondary)] [&_[data-slot=progress-indicator]]:bg-[var(--accent-red)]" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">30-day messages</p>
                <p className="mt-2 text-2xl font-semibold">{usage.monthly.totalMessages}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Estimated cost</p>
                <p className="mt-2 text-2xl font-semibold">${(usage.monthly.estimatedCostCents / 100).toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Limit</p>
                <p className="mt-2 text-2xl font-semibold">{usage.today.limitLabel}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Last 30 days</p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {usage.monthly.dailyBreakdown.length > 0 ? (
                  usage.monthly.dailyBreakdown.slice(-12).map((day) => (
                    <div key={day.date} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span>{day.date}</span>
                        <span className="font-medium">{day.messages} msgs</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">${(day.costCents / 100).toFixed(2)} estimated cost</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">No tracked usage yet.</p>
                )}
              </div>
            </div>

            {!usage.hasOwnApiKey ? (
              <div className="flex flex-wrap gap-3">
                {usage.tier !== "PROFESSIONAL" && usage.tier !== "ENTERPRISE" ? (
                  <Button asChild variant="outline" className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                    <Link href="/dashboard/settings/billing">Upgrade for more messages</Link>
                  </Button>
                ) : null}
                <Button asChild className="bg-[var(--accent-red)] text-[var(--bg-primary)] hover:bg-[var(--accent-red)]/90">
                  <Link href="/dashboard/settings/ai-config">Add your own API key</Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--accent-red)]">Usage data unavailable.</p>
        )}
      </div>
    </div>
  );
}
