import type { InsurancePolicyDTO } from "@/lib/types";

export function PolicyCard({ policy }: { policy: InsurancePolicyDTO }) {
  return (
    <div className="panel-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-semibold">{policy.policyType.replaceAll("_", " ")}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{policy.policyNumber}</p>
        </div>
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-1 text-xs text-[var(--text-secondary)]">
          {policy.status}
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{policy.summary}</p>
      <div className="grid gap-2 text-sm text-[var(--text-secondary)]">
        <p>Monthly estimate: {policy.premiumMonthly ? `$${policy.premiumMonthly}` : "Not set"}</p>
        <p>Annual estimate: {policy.premiumAnnual ? `$${policy.premiumAnnual}` : "Not set"}</p>
        <p>Coverage limit: {policy.coverageLimit ? `$${policy.coverageLimit}` : "Not set"}</p>
      </div>
    </div>
  );
}
