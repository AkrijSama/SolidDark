"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuditTimeline } from "@/components/compliance/AuditTimeline";
import { ComplianceScore } from "@/components/compliance/ComplianceScore";
import { ScanResults } from "@/components/compliance/ScanResults";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComplianceScanDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function ComplianceScanPage() {
  const [projectName, setProjectName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>(["SOC2"]);
  const [isSaving, setIsSaving] = useState(false);
  const [scans, setScans] = useState<ComplianceScanDTO[]>([]);

  async function loadScans() {
    const response = await fetch("/api/compliance/scan");
    const payload = (await response.json()) as { success: boolean; data?: ComplianceScanDTO[]; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Unable to load scans.");
    }
    setScans(payload.data);
  }

  useEffect(() => {
    void loadScans().catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load scans."));
  }, []);

  const latest = scans[0];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Compliance" title="Run scan" description="This is an AI-assisted first pass. It is useful for triage, not a substitute for a real audit." />
      <form
        className="panel-card space-y-4 p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setIsSaving(true);
          try {
            const response = await fetch("/api/compliance/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectName, repositoryUrl, frameworks }),
            });
            const payload = (await response.json()) as { success: boolean; error?: string };
            if (!response.ok || !payload.success) {
              throw new Error(payload.error ?? "Unable to run compliance scan.");
            }
            toast.success("Compliance scan completed.");
            await loadScans();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to run compliance scan.");
          } finally {
            setIsSaving(false);
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project name</Label>
            <Input id="projectName" value={projectName} onChange={(event) => setProjectName(event.target.value)} className="field-base" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repositoryUrl">Repository URL</Label>
            <Input id="repositoryUrl" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} className="field-base" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Frameworks</Label>
          <div className="flex flex-wrap gap-2">
            {["HIPAA", "GDPR", "SOC2", "FDA", "PCI_DSS", "CCPA", "ISO_27001"].map((framework) => (
              <label key={framework} className="rounded-full border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mr-2 accent-[var(--accent-red)]"
                  checked={frameworks.includes(framework)}
                  onChange={() =>
                    setFrameworks((current) =>
                      current.includes(framework) ? current.filter((value) => value !== framework) : [...current, framework],
                    )
                  }
                />
                {framework}
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={isSaving} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
          {isSaving ? "Scanning..." : "Run compliance scan"}
        </Button>
      </form>
      {latest ? (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <ComplianceScore score={latest.overallScore} />
          <ScanResults scan={latest} />
          <div className="xl:col-span-2">
            <AuditTimeline items={latest.auditTrail} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
