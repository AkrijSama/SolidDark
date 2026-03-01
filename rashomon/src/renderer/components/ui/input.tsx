import * as React from "react";

import { cn } from "@renderer/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition-colors placeholder:text-slate-500 focus-visible:border-cyan-400/45 focus-visible:ring-2 focus-visible:ring-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-slate-100 shadow-sm outline-none transition-colors placeholder:text-slate-500 focus-visible:border-cyan-400/45 focus-visible:ring-2 focus-visible:ring-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
