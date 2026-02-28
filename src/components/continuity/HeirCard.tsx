import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HEIR_ACCESS_LABELS } from "@/lib/constants";
import type { HeirDTO } from "@/lib/types";

type HeirCardProps = {
  heir: HeirDTO;
  onEdit: (heir: HeirDTO) => void;
  onDelete: (id: string) => Promise<void>;
};

export function HeirCard({ heir, onEdit, onDelete }: HeirCardProps) {
  return (
    <div className="panel-card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-semibold">{heir.fullName}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{heir.relationship}</p>
        </div>
        <Badge
          variant="outline"
          className={heir.isVerified ? "border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]" : "border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"}
        >
          {heir.isVerified ? "Verified" : "Pending"}
        </Badge>
      </div>
      <div className="space-y-2 text-sm text-[var(--text-secondary)]">
        <p>{heir.email}</p>
        <p>{heir.phone || "No phone on file"}</p>
        <p>{HEIR_ACCESS_LABELS[heir.accessLevel]}</p>
        <p>Notification order #{heir.notificationOrder}</p>
      </div>
      {heir.instructions ? (
        <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-secondary)]">
          {heir.instructions}
        </p>
      ) : null}
      <div className="mt-auto flex gap-2">
        <Button type="button" variant="outline" onClick={() => onEdit(heir)} className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
          Edit
        </Button>
        <Button type="button" variant="outline" onClick={() => void onDelete(heir.id)} className="border-[var(--accent-red)]/40 bg-transparent text-[var(--accent-red)]">
          Delete
        </Button>
      </div>
    </div>
  );
}
