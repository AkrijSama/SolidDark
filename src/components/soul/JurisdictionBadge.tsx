import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export function JurisdictionBadge({ jurisdictions }: { jurisdictions: string[] }) {
  if (jurisdictions.length === 0) {
    return (
      <Link href="/dashboard/settings/jurisdiction">
        <Badge variant="outline" className="border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]">
          Add jurisdiction
        </Badge>
      </Link>
    );
  }

  return (
    <Link href="/dashboard/settings/jurisdiction" className="flex flex-wrap gap-2">
      {jurisdictions.map((jurisdiction) => (
        <Badge key={jurisdiction} variant="outline" className="border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
          {jurisdiction}
        </Badge>
      ))}
    </Link>
  );
}
