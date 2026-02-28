import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  children: ReactNode;
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-cyan-500/90 text-slate-950 hover:bg-cyan-400",
  secondary: "bg-slate-800/70 text-slate-100 hover:bg-slate-700/70",
  danger: "bg-red-500/90 text-white hover:bg-red-400",
  ghost: "bg-transparent text-slate-200 hover:bg-white/5",
};

export function Button({ children, className = "", variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
