import * as React from "react";

import { cn } from "@renderer/lib/utils";

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-left text-sm", className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-400 [&_tr]:border-b [&_tr]:border-white/5", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("border-b border-white/5 transition-colors hover:bg-white/3", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("px-4 py-3 text-left font-code text-[10px] font-semibold tracking-[0.2em] text-slate-400", className)} {...props} />;
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle text-slate-200", className)} {...props} />;
}
