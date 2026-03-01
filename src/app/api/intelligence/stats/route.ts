import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getThreatIntelSnapshot } from "@/lib/services/threat-intelligence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user || !["PROFESSIONAL", "ENTERPRISE"].includes(user.subscriptionTier)) {
      return NextResponse.json({ error: "Requires Professional tier" }, { status: 403 });
    }

    return NextResponse.json(await getThreatIntelSnapshot(prisma));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load threat intelligence stats." },
      { status: 500 },
    );
  }
}
