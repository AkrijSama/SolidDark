import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseAdminClient, createSupabaseServerClient, requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { user } = await requireAuthenticatedAppUser();
  const supabase = await createSupabaseServerClient();
  const prisma = getPrismaClient();

  async function updateProfile(formData: FormData) {
    "use server";

    const { user: currentUser } = await requireAuthenticatedAppUser();
    const supabaseServer = await createSupabaseServerClient();
    const prismaClient = getPrismaClient();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

    const { error } = await supabaseServer.auth.updateUser({
      email,
      data: {
        full_name: fullName,
        avatar_url: avatarUrl || null,
      },
    });

    if (error) {
      redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
    }

    await prismaClient.user.update({
      where: {
        id: currentUser.id,
      },
      data: {
        fullName,
        email,
        avatarUrl: avatarUrl || null,
      },
    });

    redirect("/dashboard/settings?saved=profile");
  }

  async function deleteAccount() {
    "use server";

    const { user: currentUser, authUser: currentAuthUser } = await requireAuthenticatedAppUser();
    const adminClient = createSupabaseAdminClient();
    const prismaClient = getPrismaClient();

    await prismaClient.user.delete({
      where: {
        id: currentUser.id,
      },
    });

    const { error } = await adminClient.auth.admin.deleteUser(currentAuthUser.id);

    if (error) {
      throw new Error(`Account record was deleted locally, but Supabase account deletion failed: ${error.message}`);
    }

    const supabaseServer = await createSupabaseServerClient();
    await supabaseServer.auth.signOut();
    redirect("/signup?deleted=1");
  }

  const statusMessage =
    typeof resolvedSearchParams.saved === "string"
      ? "Settings saved."
      : typeof resolvedSearchParams.error === "string"
        ? resolvedSearchParams.error
        : null;

  await prisma.user.findUnique({
    where: {
      id: user.id,
    },
  });
  await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="General settings"
        description="Update the basic account details tied to your workspace. Email changes may require Supabase verification depending on your auth configuration."
      />

      <div className="panel-card p-6">
        <form action={updateProfile} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Name</Label>
              <Input id="fullName" name="fullName" defaultValue={user.fullName ?? ""} className="field-base" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={user.email} className="field-base" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input id="avatarUrl" name="avatarUrl" defaultValue={user.avatarUrl ?? ""} className="field-base" placeholder="https://..." />
            </div>
          </div>
          {statusMessage ? <p className="text-sm text-[var(--accent-cyan)]">{statusMessage}</p> : null}
          <Button type="submit" className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
            Save settings
          </Button>
        </form>
      </div>

      <div className="panel-card p-6">
        <h2 className="font-heading text-2xl font-semibold">Delete account</h2>
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)]">
          This deletes the SolidDark user record and your Supabase account. Continuity data, conversations, and settings attached to this account will be removed.
        </p>
        <form action={deleteAccount} className="mt-5">
          <Button type="submit" variant="outline" className="border-[var(--accent-red)]/40 bg-transparent text-[var(--accent-red)]">
            Delete account
          </Button>
        </form>
      </div>
    </div>
  );
}
