import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@renderer/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
  {
    variants: {
      variant: {
        safe: "border-green-400/25 bg-green-500/15 text-green-300",
        warn: "border-yellow-400/25 bg-yellow-500/15 text-yellow-300",
        danger: "border-red-400/25 bg-red-500/15 text-red-300",
        info: "border-cyan-400/25 bg-cyan-500/15 text-cyan-300",
        neutral: "border-white/10 bg-white/5 text-slate-300",
        agent: "border-violet-400/25 bg-violet-500/15 text-violet-300",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
