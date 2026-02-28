import type { HTMLAttributes } from "react";

const variants = {
  safe: "bg-green-500/15 text-green-300 border-green-400/25",
  warn: "bg-yellow-500/15 text-yellow-300 border-yellow-400/25",
  danger: "bg-red-500/15 text-red-300 border-red-400/25",
  info: "bg-cyan-500/15 text-cyan-300 border-cyan-400/25",
  neutral: "bg-white/5 text-slate-300 border-white/10",
  agent: "bg-violet-500/15 text-violet-300 border-violet-400/25",
};

export function Badge({
  className = "",
  children,
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
