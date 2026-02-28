"use client";

import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PLAN_DETAILS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  const [isBusy, setIsBusy] = useState<string | null>(null);

  async function startCheckout(tier: "STARTER" | "GROWTH" | "PROFESSIONAL" | "ENTERPRISE") {
    setIsBusy(tier);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier }),
      });
      const payload = (await response.json()) as { success: boolean; data?: { url: string }; error?: string };

      if (!response.ok || !payload.success || !payload.data?.url) {
        throw new Error(payload.error ?? "Unable to start checkout.");
      }

      window.location.assign(payload.data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start checkout.");
      setIsBusy(null);
    }
  }

  async function openPortal() {
    setIsBusy("portal");

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const payload = (await response.json()) as { success: boolean; data?: { url: string }; error?: string };

      if (!response.ok || !payload.success || !payload.data?.url) {
        throw new Error(payload.error ?? "Unable to open billing portal.");
      }

      window.location.assign(payload.data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open billing portal.");
      setIsBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Billing"
        description="Choose the plan that matches how much protection and infrastructure support your software business needs."
      />

      <div className="panel-card p-6">
        <div className="grid gap-4 xl:grid-cols-5">
          {PLAN_DETAILS.map((plan) => (
            <div key={plan.key} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
              <p className="font-heading text-xl font-semibold">{plan.name}</p>
              <p className="mt-2 text-2xl font-semibold">{plan.price}</p>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{plan.description}</p>
              {plan.key === "FREE" ? (
                <Button type="button" variant="outline" disabled className="mt-5 w-full border-[var(--border-default)] bg-transparent text-[var(--text-tertiary)]">
                  Current baseline
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void startCheckout(plan.key as "STARTER" | "GROWTH" | "PROFESSIONAL" | "ENTERPRISE")}
                  disabled={isBusy === plan.key}
                  className="mt-5 w-full bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90"
                >
                  {isBusy === plan.key ? "Redirecting..." : `Choose ${plan.name}`}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card p-6">
        <h2 className="font-heading text-2xl font-semibold">Manage billing</h2>
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)]">
          Use the Stripe billing portal to update payment details, review invoices, and manage an existing subscription.
        </p>
        <Button type="button" onClick={() => void openPortal()} disabled={isBusy === "portal"} className="mt-5 bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
          {isBusy === "portal" ? "Opening portal..." : "Manage Billing"}
        </Button>
      </div>

      <div className="panel-card p-6">
        <h2 className="font-heading text-2xl font-semibold">Stripe products to create</h2>
        <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)]">
          <p>`soliddark_starter` — $49/month</p>
          <p>`soliddark_growth` — $149/month</p>
          <p>`soliddark_professional` — $299/month</p>
          <p>`soliddark_enterprise` — $499/month or custom</p>
        </div>
      </div>
    </div>
  );
}
