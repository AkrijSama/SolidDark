type StatCardProps = {
  label: string;
  value: string;
  helperText: string;
};

export function StatCard({ label, value, helperText }: StatCardProps) {
  return (
    <div className="panel-card p-5">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-3 font-heading text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--text-tertiary)]">{helperText}</p>
    </div>
  );
}
