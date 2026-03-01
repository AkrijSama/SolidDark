import { redirect } from "next/navigation";

import { ThreatIntelDashboard } from "@/components/intelligence/ThreatIntelDashboard";
import { PageHeader } from "@/components/shared/PageHeader";
import { getPrismaClient } from "@/lib/prisma";
import { getThreatIntelSnapshot } from "@/lib/services/threat-intelligence";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const { user } = await requireAuthenticatedAppUser();

  if (!["PROFESSIONAL", "ENTERPRISE"].includes(user.subscriptionTier)) {
    redirect("/dashboard/settings/billing");
  }

  const prisma = getPrismaClient();
  const data = await getThreatIntelSnapshot(prisma);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collective defense"
        title="Threat intelligence"
        description="Rashomon installations feed anonymized security telemetry into a shared network view. This page surfaces the domains, agents, and leak patterns rising across the fleet."
      />
      <ThreatIntelDashboard data={data} />
    </div>
  );
}
