import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";

const sections = [
  {
    title: "Business Continuity",
    href: "/dashboard/continuity",
    status: "Ready for setup",
    description: "Protect credentials, heirs, and continuity documents before your business depends on you alone.",
  },
  {
    title: "Verified Work Ledger",
    href: "/dashboard/ledger",
    status: "Ready for setup",
    description: "Turn shipped work into a signed, portable proof record instead of a hand-wavy portfolio claim.",
  },
  {
    title: "Compliance Layer",
    href: "/dashboard/compliance",
    status: "Ready for setup",
    description: "Get a baseline read on the compliance frameworks your AI product is about to trip over.",
  },
  {
    title: "Insurance Platform",
    href: "/dashboard/insurance",
    status: "Ready for setup",
    description: "See your operational risk profile before a carrier or enterprise customer asks the hard questions.",
  },
  {
    title: "Developer Collective",
    href: "/dashboard/collective",
    status: "Ready for setup",
    description: "Coordinate members, projects, and revenue splits without spreadsheet drift.",
  },
];

export default function DashboardHomePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Your protection stack"
        description="SolidDark is organized around the business failures solo AI builders usually discover too late: no legal backup, no continuity plan, no compliance record, no insurance prep, and no collective operating structure."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Coverage map" value="5" helperText="Product verticals available in this workspace." />
        <StatCard label="Jurisdictions" value="1+" helperText="Legal context applied to documents and the Soul." />
        <StatCard label="Risk posture" value="Early" helperText="Most builders start here. The point is to move deliberately." />
        <StatCard label="Next step" value="Continuity" helperText="It is the fastest path to actual protection." />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map((section) => (
          <div key={section.href} className="panel-card flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl font-semibold">{section.title}</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{section.description}</p>
              </div>
              <span className="rounded-full border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-amber)]">
                {section.status}
              </span>
            </div>
            <div className="mt-auto flex items-center justify-between">
              <p className="text-sm text-[var(--text-tertiary)]">Open the workspace to configure this vertical.</p>
              <Link href={section.href} className="rounded-lg bg-[var(--accent-red)] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-[var(--accent-red)]/90">
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
