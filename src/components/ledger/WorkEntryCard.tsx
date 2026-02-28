import { VerificationBadge } from "@/components/ledger/VerificationBadge";
import type { WorkEntryDTO } from "@/lib/types";

export function WorkEntryCard({ entry }: { entry: WorkEntryDTO }) {
  return (
    <div className="panel-card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-semibold">{entry.projectName}</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{entry.description}</p>
        </div>
        <VerificationBadge status={entry.status} />
      </div>
      <div className="flex flex-wrap gap-2">
        {entry.techStack.map((item) => (
          <span key={item} className="rounded-full border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            {item}
          </span>
        ))}
      </div>
      <div className="grid gap-2 text-sm text-[var(--text-secondary)]">
        <p>Platform: {entry.platform || "Not provided"}</p>
        <p>Evidence hash: <span className="font-mono text-xs">{entry.evidenceHash}</span></p>
        <p>Verified at: {entry.verifiedAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(entry.verifiedAt)) : "Not yet verified"}</p>
      </div>
      {entry.deploymentUrl ? <a href={entry.deploymentUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent-cyan)]">Open deployment</a> : null}
      {entry.repositoryUrl ? <a href={entry.repositoryUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent-cyan)]">Open repository</a> : null}
    </div>
  );
}
