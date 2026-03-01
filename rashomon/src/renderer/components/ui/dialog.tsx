import * as React from "react";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@renderer/lib/utils";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn("fixed inset-0 z-50 bg-black/75 backdrop-blur-sm", className)} {...props} />;
}

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "panel fixed top-1/2 left-1/2 z-50 w-[min(96vw,48rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/8 p-0 shadow-2xl duration-200",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <DialogPrimitive.Title className="font-code text-sm font-semibold uppercase tracking-[0.24em] text-slate-200">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-lg p-1 text-slate-400 transition hover:bg-white/5 hover:text-white">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="px-5 py-4">{children}</div>
      </DialogContent>
    </DialogPrimitive.Root>
  );
}
