import type { CollectiveMemberDTO } from "@/lib/types";

export function MemberCard({ member }: { member: CollectiveMemberDTO }) {
  return (
    <div className="panel-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-semibold">{member.fullName ?? member.email}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{member.email}</p>
        </div>
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-1 text-xs text-[var(--text-secondary)]">
          {member.role}
        </span>
      </div>
      <p className="mt-4 text-sm text-[var(--text-secondary)]">Revenue share: {member.revenueShare ? `${member.revenueShare}%` : "Not set"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {member.skills.map((skill) => (
          <span key={skill} className="rounded-full border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}
