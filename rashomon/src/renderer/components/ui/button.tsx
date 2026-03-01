import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@renderer/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-cyan-400/25 bg-cyan-500/90 text-slate-950 shadow-[0_0_0_1px_rgb(6_182_212_/_0.25),0_0_24px_rgb(6_182_212_/_0.14)] hover:bg-cyan-400",
        secondary: "border-white/10 bg-white/6 text-slate-100 hover:border-white/15 hover:bg-white/10",
        danger: "border-red-400/30 bg-red-500/90 text-white shadow-[0_0_0_1px_rgb(239_68_68_/_0.22),0_0_24px_rgb(239_68_68_/_0.12)] hover:bg-red-400",
        ghost: "border-transparent bg-transparent text-slate-200 hover:bg-white/5 hover:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
