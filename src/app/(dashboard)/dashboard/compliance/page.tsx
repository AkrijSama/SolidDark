import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const prisma = getPrismaClient();
  const { user } = await requireAuthenticatedAppUser();
  const [scanCount, averageScore] = await Promise.all([
    prisma.complianceScan.count({ where: { userId: user.id } }),
    prisma.complianceScan.aggregate({ where: { userId: user.id }, _avg: { overallScore: true } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Compliance" title="Compliance layer" description="Run lightweight framework scans and keep a plain-language audit trail for what you checked." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Scans run" value={String(scanCount)} helperText="Compliance checks stored in this workspace." />
        <StatCard label="Average score" value={String(Math.round(averageScore._avg.overallScore ?? 0))} helperText="Average score across saved scans." />
        <StatCard label="Next step" value={scanCount === 0 ? "Scan" : "Report"} helperText="Run a new scan or review saved audit trails." />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Link href="/dashboard/compliance/scan" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h2 className="font-heading text-2xl font-semibold">Run scan</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Paste a repository URL, choose frameworks, and get a first-pass compliance read.</p>
        </Link>
        <Link href="/dashboard/compliance/reports" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h2 className="font-heading text-2xl font-semibold">Audit reports</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Review the audit trail and export a plain-language report for each scan.</p>
        </Link>
      </div>
    </div>
  );
}
