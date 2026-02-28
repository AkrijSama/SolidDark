import { LockKeyhole } from "lucide-react";

export function EncryptedBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-cyan)]">
      <LockKeyhole className="h-3.5 w-3.5" />
      Encrypted
    </span>
  );
}
