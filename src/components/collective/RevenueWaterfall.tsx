export function RevenueWaterfall({ items }: { items: Array<{ label: string; percentage: number }> }) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No revenue waterfall configured yet.</p>
      ) : (
        items.map((item) => (
          <div key={`${item.label}-${item.percentage}`}>
            <div className="flex items-center justify-between text-sm">
              <span>{item.label}</span>
              <span>{item.percentage}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[var(--bg-tertiary)]">
              <div className="h-2 rounded-full bg-[var(--accent-cyan)]" style={{ width: `${Math.min(item.percentage, 100)}%` }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
