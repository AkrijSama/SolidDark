import type { NextRequest } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, jsonError, jsonOk } from "@/lib/utils";

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const scans = await prisma.complianceScan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return jsonOk(
      scans.map((scan) => ({
        id: scan.id,
        projectName: scan.projectName,
        overallScore: scan.overallScore,
        frameworks: scan.frameworks,
        auditTrail: (scan.auditTrail as Array<{ title: string; detail: string }> | null) ?? [],
        createdAt: scan.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load compliance reports."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const scanId = String(body.scanId ?? "").trim();

    if (!scanId) {
      return jsonError("Scan id is required.", 400);
    }

    const scan = await prisma.complianceScan.findFirst({
      where: {
        id: scanId,
        userId: user.id,
      },
    });

    if (!scan) {
      return jsonError("Compliance scan not found.", 404);
    }

    const reportMarkdown = [
      `# Compliance Report: ${scan.projectName}`,
      ``,
      `Repository: ${scan.repositoryUrl}`,
      `Frameworks: ${scan.frameworks.join(", ")}`,
      `Overall Score: ${scan.overallScore}`,
      ``,
      `## Audit Trail`,
      ...(((scan.auditTrail as Array<{ title: string; detail: string }> | null) ?? []).map((item) => `- **${item.title}**: ${item.detail}`)),
    ].join("\n");

    return jsonOk({ markdown: reportMarkdown });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to generate compliance report."), 500);
  }
}
