import { DocumentGenerator } from "@/components/continuity/DocumentGenerator";
import { PageHeader } from "@/components/shared/PageHeader";

export const dynamic = "force-dynamic";

export default function ContinuityDocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Continuity"
        title="Legal documents"
        description="Generate continuity plans and handoff documents grounded in your active jurisdiction."
      />
      <DocumentGenerator />
    </div>
  );
}
