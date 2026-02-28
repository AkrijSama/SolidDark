"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BriefcaseBusiness,
  ChevronLeft,
  FileCheck2,
  HeartHandshake,
  Home,
  Landmark,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/soul", label: "Soul", icon: Sparkles },
  { href: "/dashboard/continuity", label: "Continuity", icon: HeartHandshake },
  { href: "/dashboard/ledger", label: "Ledger", icon: FileCheck2 },
  { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/dashboard/insurance", label: "Insurance", icon: Landmark },
  { href: "/dashboard/collective", label: "Collective", icon: BriefcaseBusiness },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn("hidden min-h-screen border-r border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 lg:flex lg:flex-col", collapsed ? "w-24" : "w-72")}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] pb-4">
        <div className={cn("overflow-hidden", collapsed && "sr-only")}>
          <p className="font-heading text-xl font-semibold">SolidDark</p>
          <p className="text-xs text-[var(--text-tertiary)]">Control room</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-2 text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>
      <nav className="mt-6 flex flex-1 flex-col gap-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-all duration-200",
                active
                  ? "border-[var(--accent-red)] bg-[var(--accent-red)]/10 text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(collapsed && "hidden")}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
