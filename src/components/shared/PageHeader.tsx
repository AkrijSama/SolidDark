type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">{eyebrow}</p> : null}
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
