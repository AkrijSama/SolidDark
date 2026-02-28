import { PageHeader } from "@/components/shared/PageHeader";
import { ChatInterface } from "@/components/soul/ChatInterface";

export const dynamic = "force-dynamic";

export default function SoulPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="The Soul"
        title="AI legal advisor"
        description="Ask direct questions about law, continuity, compliance, risk, and business protection for the software you ship."
      />
      <ChatInterface />
    </div>
  );
}
