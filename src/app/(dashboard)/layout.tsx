import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { createSupabaseServerClient, upsertAppUserFromSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Failed to load authenticated user: ${error.message}`);
  }

  if (!authUser) {
    redirect("/login");
  }

  const user = await upsertAppUserFromSupabase(authUser);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="flex min-h-screen">
        <Sidebar subscriptionTier={user.subscriptionTier} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar
            email={user.email}
            fullName={user.fullName}
            avatarUrl={user.avatarUrl}
            jurisdictions={user.jurisdictions}
            subscriptionTier={user.subscriptionTier}
          />
          <main className="page-fade flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
