"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/soul", label: "Soul" },
  { href: "/dashboard/continuity", label: "Continuity" },
  { href: "/dashboard/ledger", label: "Ledger" },
  { href: "/dashboard/compliance", label: "Compliance" },
  { href: "/dashboard/insurance", label: "Insurance" },
  { href: "/dashboard/collective", label: "Collective" },
  { href: "/dashboard/intelligence", label: "Threat Intel", minTier: "PROFESSIONAL" },
  { href: "/dashboard/settings", label: "Settings" },
];

function canAccessItem(item: (typeof navItems)[number], tier: SubscriptionTier) {
  if (!("minTier" in item) || !item.minTier) {
    return true;
  }

  return tier === "PROFESSIONAL" || tier === "ENTERPRISE";
}

export function MobileNav({ subscriptionTier }: { subscriptionTier: SubscriptionTier }) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] lg:hidden">
          <Menu className="h-4 w-4" />
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
        <SheetHeader>
          <SheetTitle className="font-heading text-left text-xl text-[var(--text-primary)]">SolidDark</SheetTitle>
        </SheetHeader>
        <div className="mt-8 flex flex-col gap-2">
          {navItems.filter((item) => canAccessItem(item, subscriptionTier)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg border px-3 py-3 text-sm font-medium transition-all duration-200",
                  active
                    ? "border-[var(--accent-red)] bg-[var(--accent-red)]/10 text-[var(--text-primary)]"
                    : "border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
