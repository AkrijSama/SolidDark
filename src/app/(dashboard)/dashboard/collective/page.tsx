import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CollectivePage() {
  const prisma = getPrismaClient();
  const { user } = await requireAuthenticatedAppUser();
  const membership = await prisma.collectiveMember.findFirst({
    where: { userId: user.id },
    include: { collective: true },
  });
  const projectCount = membership ? await prisma.collectiveProject.count({ where: { collectiveId: membership.collectiveId } }) : 0;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collective" title="Developer collective" description="Run small-team projects, members, and revenue splits without spreadsheet drift." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Collective" value={membership?.collective.name ?? "None"} helperText="Your current collective membership." />
        <StatCard label="Projects" value={String(projectCount)} helperText="Projects inside the current collective." />
        <StatCard label="Next step" value={membership ? "Members" : "Create"} helperText="Create a collective or manage the one you already have." />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Link href="/dashboard/collective/members" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h2 className="font-heading text-2xl font-semibold">Members</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Create a collective, join one, and manage member roles and shares.</p>
        </Link>
        <Link href="/dashboard/collective/projects" className="panel-card p-6 transition-all hover:border-[var(--border-hover)]">
          <h2 className="font-heading text-2xl font-semibold">Projects</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Track client work, project status, and revenue waterfall rules.</p>
        </Link>
      </div>
    </div>
  );
}
