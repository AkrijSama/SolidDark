import type { ComplianceScanDTO } from "@/lib/types";

export function ScanResults({ scan }: { scan: ComplianceScanDTO }) {
  return (
    <div className="panel-card p-5">
      <h3 className="font-heading text-xl font-semibold">{scan.projectName}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{scan.summary}</p>
      <div className="mt-4 space-y-3">
        {scan.issues.length === 0 ? (
          <p className="text-sm text-[var(--accent-cyan)]">No issues were returned for this scan.</p>
        ) : (
          scan.issues.map((issue) => (
            <div key={`${issue.severity}-${issue.title}`} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
              <p className="font-medium text-[var(--text-primary)]">{issue.title}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{issue.severity}</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{issue.explanation}</p>
              {issue.recommendation ? <p className="mt-2 text-sm text-[var(--accent-cyan)]">{issue.recommendation}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
