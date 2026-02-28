import { Progress } from "@/components/ui/progress";

export function ComplianceScore({ score }: { score: number }) {
  return (
    <div className="panel-card p-5">
      <p className="text-sm text-[var(--text-secondary)]">Overall score</p>
      <p className="font-heading mt-2 text-3xl font-semibold">{score}</p>
      <Progress value={score} className="mt-4 h-3 bg-[var(--bg-tertiary)]" />
    </div>
  );
}
