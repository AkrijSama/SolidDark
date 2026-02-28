import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { INSURANCE_DISCLAIMER_LINES } from "@/lib/constants";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InsurancePage() {
  const prisma = getPrismaClient();
  const { user } = await requireAuthenticatedAppUser();
  const [policyCount, averageRisk] = await Promise.all([
    prisma.insurancePolicy.count({ where: { userId: user.id } }),
    prisma.insurancePolicy.aggregate({ where: { userId: user.id }, _avg: { riskScore: true } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Insurance" title="Insurance platform" description="Estimate the risk profile of your AI software before you step into underwriting conversations." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Quotes stored" value={String(policyCount)} helperText="Saved informational policy estimates." />
        <StatCard label="Average risk" value={String(Math.round(averageRisk._avg.riskScore ?? 0))} helperText="Average risk score across saved quotes." />
        <StatCard label="Next step" value={policyCount === 0 ? "Assess" : "Manage"} helperText="Run a risk assessment or update quote status." />
      </div>
      <div className="panel-card p-6">
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          {INSURANCE_DISCLAIMER_LINES.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Link href="/dashboard/insurance/assess" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h2 className="font-heading text-2xl font-semibold">Risk assessment</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Generate an informational quote estimate and factor breakdown.</p>
        </Link>
        <Link href="/dashboard/insurance/policies" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h2 className="font-heading text-2xl font-semibold">Policy management</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Track quote status as you move from estimate to underwriting conversations.</p>
        </Link>
      </div>
    </div>
  );
}
