"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuditTimeline } from "@/components/compliance/AuditTimeline";
import { PageHeader } from "@/components/shared/PageHeader";

export const dynamic = "force-dynamic";

export default function ComplianceReportsPage() {
  const [reports, setReports] = useState<Array<{ id: string; projectName: string; overallScore: number; frameworks: string[]; auditTrail: Array<{ title: string; detail: string }>; createdAt: string }>>([]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/compliance/reports");
        const payload = (await response.json()) as { success: boolean; data?: typeof reports; error?: string };
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to load reports.");
        }
        setReports(payload.data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load reports.");
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Compliance" title="Audit reports" description="Review the saved audit trail for your scans and generate markdown reports from them." />
      <div className="grid gap-4">
        {reports.map((report) => (
          <div key={report.id} className="space-y-4">
            <div className="panel-card p-5">
              <h2 className="font-heading text-2xl font-semibold">{report.projectName}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Frameworks: {report.frameworks.join(", ")} • Score: {report.overallScore}</p>
            </div>
            <AuditTimeline items={report.auditTrail} />
          </div>
        ))}
      </div>
    </div>
  );
}
