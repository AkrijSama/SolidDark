import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const prisma = getPrismaClient();
  const { user } = await requireAuthenticatedAppUser();
  const [totalEntries, verifiedEntries] = await Promise.all([
    prisma.workEntry.count({ where: { userId: user.id } }),
    prisma.workEntry.count({ where: { userId: user.id, status: "VERIFIED" } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Ledger" title="Verified work ledger" description="Turn shipped work into signed evidence instead of portfolio hand-waving." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Registered entries" value={String(totalEntries)} helperText="Signed work records stored in your ledger." />
        <StatCard label="Verified entries" value={String(verifiedEntries)} helperText="Entries that passed signature verification and were marked verified." />
        <StatCard label="Next step" value={totalEntries === 0 ? "Register" : "Verify"} helperText="Add a project or verify an existing entry." />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Link href="/dashboard/ledger/register" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h2 className="font-heading text-2xl font-semibold">Register work</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Capture the deployment, repository, evidence hash, and signature for a shipped project.</p>
        </Link>
        <Link href="/dashboard/ledger/verify" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h2 className="font-heading text-2xl font-semibold">Verify entries</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Check whether an entry’s signature still matches and mark it verified.</p>
        </Link>
      </div>
    </div>
  );
}
