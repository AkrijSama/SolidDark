import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@renderer/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-white/10 bg-white/5 shadow-sm outline-none transition-all data-[state=checked]:border-cyan-400/45 data-[state=checked]:bg-cyan-500/20",
      )}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 translate-x-1 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-6" />
    </SwitchPrimitive.Root>
  );
}
