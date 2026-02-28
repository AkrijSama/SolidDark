import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContinuityPage() {
  const prisma = getPrismaClient();
  const { user } = await requireAuthenticatedAppUser();

  const [vaultCount, heirCount, documentCount, deadmanConfig] = await Promise.all([
    prisma.vaultEntry.count({ where: { userId: user.id } }),
    prisma.heir.count({ where: { userId: user.id } }),
    prisma.generatedDocument.count({ where: { userId: user.id } }),
    prisma.deadmanConfig.findUnique({ where: { userId: user.id } }),
  ]);

  const setupNeeded = vaultCount === 0 && heirCount === 0 && documentCount === 0 && !deadmanConfig;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Continuity"
        title="Business continuity"
        description="The point is simple: if you disappear for a week, your product should not collapse, lock customers out, or leave your family and partners blind."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Credentials stored" value={String(vaultCount)} helperText="Encrypted service access records in the vault." />
        <StatCard label="Heirs configured" value={String(heirCount)} helperText="People who can keep the business alive if you cannot." />
        <StatCard label="Dead-man switch" value={deadmanConfig?.isEnabled ? "On" : "Off"} helperText="Automatic escalation if you stop checking in." />
        <StatCard label="Documents generated" value={String(documentCount)} helperText="Continuity documents prepared for review and use." />
      </div>

      {setupNeeded ? (
        <div className="panel-card p-6">
          <h2 className="font-heading text-2xl font-semibold">Setup wizard</h2>
          <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)]">
            Start by storing the systems that would kill your business if nobody could access them. Then add the people who should be contacted, turn on the check-in timer, and generate the documents those people would need.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/continuity/vault" className="rounded-lg bg-[var(--accent-red)] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-[var(--accent-red)]/90">
              Add your first credential
            </Link>
            <Link href="/dashboard/continuity/heirs" className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--border-hover)]">
              Add your first heir
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Link href="/dashboard/continuity/vault" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h3 className="font-heading text-2xl font-semibold">Credential vault</h3>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Store the cloud, payments, hosting, and source-control access that keeps revenue flowing.</p>
        </Link>
        <Link href="/dashboard/continuity/heirs" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h3 className="font-heading text-2xl font-semibold">Infrastructure heirs</h3>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Assign who gets notified first, what they can access, and what you expect them to do.</p>
        </Link>
        <Link href="/dashboard/continuity/deadman" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h3 className="font-heading text-2xl font-semibold">Dead-man switch</h3>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Set the timer that escalates from a private warning to a continuity event.</p>
        </Link>
        <Link href="/dashboard/continuity/documents" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h3 className="font-heading text-2xl font-semibold">Legal documents</h3>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Generate continuity plans, powers of attorney, and handoff documents with jurisdiction context.</p>
        </Link>
      </div>
    </div>
  );
}
