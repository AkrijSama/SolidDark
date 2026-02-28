import { Badge } from "@/components/ui/badge";

export function VerificationBadge({ status }: { status: string }) {
  const styles =
    status === "VERIFIED"
      ? "border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]"
      : status === "DISPUTED"
        ? "border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
        : "border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]";

  return (
    <Badge variant="outline" className={styles}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
