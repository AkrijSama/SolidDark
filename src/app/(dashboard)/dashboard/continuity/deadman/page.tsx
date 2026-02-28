import { DeadmanConfig } from "@/components/continuity/DeadmanConfig";
import { PageHeader } from "@/components/shared/PageHeader";

export const dynamic = "force-dynamic";

export default function ContinuityDeadmanPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Continuity"
        title="Dead-man switch"
        description="If you stop checking in, SolidDark escalates from a private warning to continuity notifications."
      />
      <DeadmanConfig />
    </div>
  );
}
