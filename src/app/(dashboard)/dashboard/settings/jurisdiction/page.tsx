import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { JURISDICTION_DESCRIPTIONS, JURISDICTION_OPTIONS } from "@/lib/constants";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getJurisdictionDescription(code: string) {
  if (code.startsWith("US-")) {
    return JURISDICTION_DESCRIPTIONS.US;
  }
  if (code.startsWith("EU-")) {
    return JURISDICTION_DESCRIPTIONS.EU;
  }
  if (code.startsWith("UK-")) {
    return JURISDICTION_DESCRIPTIONS.UK;
  }
  if (code.startsWith("CA-")) {
    return JURISDICTION_DESCRIPTIONS.CA;
  }
  if (code.startsWith("AU-")) {
    return JURISDICTION_DESCRIPTIONS.AU;
  }

  return "Activates additional legal context for this jurisdiction.";
}

export default async function JurisdictionSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const prisma = getPrismaClient();
  const { user } = await requireAuthenticatedAppUser();

  async function saveJurisdictions(formData: FormData) {
    "use server";

    const { user: currentUser } = await requireAuthenticatedAppUser();
    const prismaClient = getPrismaClient();
    const jurisdictions = formData.getAll("jurisdictions").map((value) => String(value));

    if (jurisdictions.length === 0) {
      redirect("/dashboard/settings/jurisdiction?error=Select at least one jurisdiction.");
    }

    await prismaClient.user.update({
      where: {
        id: currentUser.id,
      },
      data: {
        jurisdictions,
      },
    });

    redirect("/dashboard/settings/jurisdiction?saved=1");
  }

  await prisma.user.findUnique({
    where: {
      id: user.id,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Jurisdictions"
        description="Pick the places whose laws you need SolidDark to keep in view. This affects the Soul, continuity documents, and risk framing."
      />

      <form action={saveJurisdictions} className="panel-card space-y-6 p-6">
        {typeof resolvedSearchParams.saved === "string" ? <p className="text-sm text-[var(--accent-cyan)]">Jurisdictions updated.</p> : null}
        {typeof resolvedSearchParams.error === "string" ? <p className="text-sm text-[var(--accent-red)]">{resolvedSearchParams.error}</p> : null}

        {Object.entries(JURISDICTION_OPTIONS).map(([region, codes]) => (
          <section key={region} className="space-y-4">
            <div>
              <h2 className="font-heading text-2xl font-semibold">{region}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {codes.map((code) => (
                <label key={code} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="jurisdictions"
                      value={code}
                      defaultChecked={user.jurisdictions.includes(code)}
                      className="mt-1 h-4 w-4 accent-[var(--accent-red)]"
                    />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{code}</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">{getJurisdictionDescription(code)}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        ))}

        <Button type="submit" className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
          Save jurisdictions
        </Button>
      </form>
    </div>
  );
}
