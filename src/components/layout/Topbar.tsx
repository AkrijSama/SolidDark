"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import type { SubscriptionTier } from "@prisma/client";

import { MobileNav } from "@/components/layout/MobileNav";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TopbarProps = {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  jurisdictions: string[];
  subscriptionTier: SubscriptionTier;
};

export function Topbar({ email, fullName, avatarUrl, jurisdictions, subscriptionTier }: TopbarProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      toast.success("Signed out.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-default)] bg-[rgba(10,10,15,0.88)] px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileNav subscriptionTier={subscriptionTier} />
          <div>
            <p className="font-heading text-lg font-semibold">SolidDark</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {jurisdictions.map((jurisdiction) => (
                <Badge key={jurisdiction} variant="outline" className="border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
                  {jurisdiction}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl ?? undefined} alt={fullName ?? email} />
              <AvatarFallback className="bg-[var(--accent-blue)] text-white">
                {(fullName ?? email).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-[var(--text-primary)]">{fullName ?? "SolidDark User"}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{email}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/billing" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[var(--border-default)]" />
            <DropdownMenuItem onClick={() => void handleLogout()} className="flex cursor-pointer items-center gap-2 text-[var(--accent-red)]">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
