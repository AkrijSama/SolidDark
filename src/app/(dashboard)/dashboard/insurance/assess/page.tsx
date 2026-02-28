"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { QuoteForm } from "@/components/insurance/QuoteForm";
import { RiskGauge } from "@/components/insurance/RiskGauge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { InsurancePolicyDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function InsuranceAssessPage() {
  const [policies, setPolicies] = useState<InsurancePolicyDTO[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  async function loadPolicies() {
    const response = await fetch("/api/insurance/assess");
    const payload = (await response.json()) as { success: boolean; data?: InsurancePolicyDTO[]; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Unable to load assessments.");
    }
    setPolicies(payload.data);
  }

  useEffect(() => {
    void loadPolicies().catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load assessments."));
  }, []);

  const latest = policies[0];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insurance" title="Risk assessment" description="Generate an informational estimate. It is not a binding policy." />
      <QuoteForm
        isSaving={isSaving}
        onSubmit={async (values) => {
          setIsSaving(true);
          try {
            const response = await fetch("/api/insurance/assess", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(values),
            });
            const payload = (await response.json()) as { success: boolean; error?: string };
            if (!response.ok || !payload.success) {
              throw new Error(payload.error ?? "Unable to assess risk.");
            }
            toast.success("Risk assessment completed.");
            await loadPolicies();
          } finally {
            setIsSaving(false);
          }
        }}
      />
      {latest ? (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <RiskGauge score={latest.riskScore} />
          <div className="panel-card p-5">
            <h3 className="font-heading text-xl font-semibold">{latest.policyType.replaceAll("_", " ")}</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{latest.summary}</p>
            <div className="mt-4 grid gap-3">
              {latest.riskFactors.map((factor) => (
                <div key={factor.label} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                  <p className="font-medium">{factor.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{factor.severity}</p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{factor.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
