import * as React from "react";

import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@renderer/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex h-11 items-center rounded-xl border border-white/8 bg-white/4 p-1 text-slate-400", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-200 data-[state=active]:shadow-sm hover:text-slate-100",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-4 outline-none", className)} {...props} />;
}
