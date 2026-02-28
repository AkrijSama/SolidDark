import { RevenueWaterfall } from "@/components/collective/RevenueWaterfall";
import type { CollectiveProjectDTO } from "@/lib/types";

export function ProjectCard({ project }: { project: CollectiveProjectDTO }) {
  return (
    <div className="panel-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-semibold">{project.name}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{project.clientName || "No client listed"}</p>
        </div>
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-1 text-xs text-[var(--text-secondary)]">
          {project.status}
        </span>
      </div>
      <p className="mt-4 text-sm text-[var(--text-secondary)]">Contract value: {project.contractValue ? `$${project.contractValue}` : "Not set"}</p>
      <div className="mt-4">
        <RevenueWaterfall items={project.revenueWaterfall} />
      </div>
    </div>
  );
}
