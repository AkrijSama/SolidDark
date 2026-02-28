import type { NextRequest } from "next/server";
import { PolicyStatus } from "@prisma/client";

import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, jsonError, jsonOk } from "@/lib/utils";

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const policies = await prisma.insurancePolicy.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(
      policies.map((policy) => ({
        id: policy.id,
        policyNumber: policy.policyNumber,
        policyType: policy.policyType,
        applicationUrl: policy.applicationUrl,
        riskScore: policy.riskScore,
        status: policy.status,
        premiumMonthly: policy.premiumMonthly?.toString() ?? null,
        premiumAnnual: policy.premiumAnnual?.toString() ?? null,
        coverageLimit: policy.coverageLimit?.toString() ?? null,
        deductible: policy.deductible?.toString() ?? null,
        summary: (policy.riskFactors as { summary?: string })?.summary ?? "",
        riskFactors: (policy.riskFactors as { factors?: unknown[] })?.factors ?? [],
        createdAt: policy.createdAt.toISOString(),
        updatedAt: policy.updatedAt.toISOString(),
      })),
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load policies."), 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim() as PolicyStatus;

    if (!id || !Object.values(PolicyStatus).includes(status)) {
      return jsonError("Policy id and valid status are required.", 400);
    }

    const policy = await prisma.insurancePolicy.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!policy) {
      return jsonError("Policy not found.", 404);
    }

    const updated = await prisma.insurancePolicy.update({
      where: { id: policy.id },
      data: {
        status,
      },
    });

    return jsonOk({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to update policy."), 500);
  }
}
