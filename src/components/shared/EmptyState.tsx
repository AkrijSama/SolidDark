import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export function EmptyState({ title, description, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="panel-card flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <h3 className="font-heading text-2xl font-semibold">{title}</h3>
      <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)]">{description}</p>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-5 inline-flex rounded-lg bg-[var(--accent-red)] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
