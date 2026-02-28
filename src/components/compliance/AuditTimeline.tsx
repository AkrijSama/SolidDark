export function AuditTimeline({ items }: { items: Array<{ title: string; detail: string }> }) {
  return (
    <div className="panel-card p-5">
      <h3 className="font-heading text-xl font-semibold">Audit trail</h3>
      <div className="mt-4 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No audit trail generated yet.</p>
        ) : (
          items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="relative pl-6">
              <div className="absolute left-0 top-2 h-2 w-2 rounded-full bg-[var(--accent-cyan)]" />
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
