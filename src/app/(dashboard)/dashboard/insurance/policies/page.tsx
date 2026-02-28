"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { PolicyCard } from "@/components/insurance/PolicyCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import type { InsurancePolicyDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function InsurancePoliciesPage() {
  const [policies, setPolicies] = useState<InsurancePolicyDTO[]>([]);

  async function loadPolicies() {
    const response = await fetch("/api/insurance/policies");
    const payload = (await response.json()) as { success: boolean; data?: InsurancePolicyDTO[]; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Unable to load policies.");
    }
    setPolicies(payload.data);
  }

  const handleInitialLoad = useEffectEvent(async () => {
    try {
      await loadPolicies();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load policies.");
    }
  });

  useEffect(() => {
    void handleInitialLoad();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insurance" title="Policy management" description="Track quote records as they move through your internal review and underwriting conversations." />
      <div className="grid gap-4 xl:grid-cols-2">
        {policies.map((policy) => (
          <div key={policy.id} className="space-y-3">
            <PolicyCard policy={policy} />
            <div className="flex flex-wrap gap-2">
              {["QUOTE", "APPLIED", "UNDERWRITING", "ACTIVE", "EXPIRED", "CANCELLED"].map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const response = await fetch("/api/insurance/policies", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: policy.id, status }),
                    });
                    const payload = (await response.json()) as { success: boolean; error?: string };
                    if (!response.ok || !payload.success) {
                      toast.error(payload.error ?? "Unable to update policy.");
                      return;
                    }
                    toast.success("Policy status updated.");
                    await loadPolicies();
                  }}
                  className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
