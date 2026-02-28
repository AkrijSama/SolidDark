import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { ComplianceFramework, ScanStatus } from "@prisma/client";

import { COMPLIANCE_SCAN_PROMPT } from "@/lib/ai/prompts/compliance-scan";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, extractJsonFromText, getRequiredEnv, jsonError, jsonOk } from "@/lib/utils";

type ComplianceResponse = {
  summary: string;
  overallScore: number;
  criticalIssues: Array<{ title: string; explanation: string; recommendation?: string }>;
  warnings: Array<{ title: string; explanation: string; recommendation?: string }>;
  passedChecks: string[];
  auditTrail: Array<{ title: string; detail: string }>;
};

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const scans = await prisma.complianceScan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(
      scans.map((scan) => ({
        id: scan.id,
        projectName: scan.projectName,
        repositoryUrl: scan.repositoryUrl,
        frameworks: scan.frameworks,
        overallScore: scan.overallScore,
        status: scan.status,
        criticalIssuesCount: scan.criticalIssues,
        warningsCount: scan.warnings,
        passedChecksCount: scan.passedChecks,
        summary: (scan.scanResults as { summary?: string })?.summary ?? "",
        issues: (scan.scanResults as { issues?: unknown[] })?.issues ?? [],
        passedChecks: (scan.scanResults as { passedChecks?: string[] })?.passedChecks ?? [],
        auditTrail: (scan.auditTrail as Array<{ title: string; detail: string }> | null) ?? [],
        createdAt: scan.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load compliance scans."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const projectName = String(body.projectName ?? "").trim();
    const repositoryUrl = String(body.repositoryUrl ?? "").trim();
    const frameworks = Array.isArray(body.frameworks)
      ? body.frameworks.map((value) => String(value) as ComplianceFramework).filter((value) => Object.values(ComplianceFramework).includes(value))
      : [];

    if (!projectName || !repositoryUrl || frameworks.length === 0) {
      return jsonError("Project name, repository URL, and at least one framework are required.", 400);
    }

    const anthropic = new Anthropic({
      apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    });

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1800,
      temperature: 0.2,
      system: COMPLIANCE_SCAN_PROMPT,
      messages: [
        {
          role: "user",
          content: `Project: ${projectName}\nRepository: ${repositoryUrl}\nFrameworks: ${frameworks.join(", ")}\n\nReturn the requested JSON only.`,
        },
      ],
    });

    const text = completion.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
    const parsed = extractJsonFromText<ComplianceResponse>(text);
    const scanResults = {
      summary: parsed.summary,
      issues: [
        ...parsed.criticalIssues.map((issue) => ({ ...issue, severity: "critical" })),
        ...parsed.warnings.map((issue) => ({ ...issue, severity: "warning" })),
      ],
      passedChecks: parsed.passedChecks,
    };

    const scan = await prisma.complianceScan.create({
      data: {
        userId: user.id,
        projectName,
        repositoryUrl,
        frameworks,
        scanResults,
        overallScore: parsed.overallScore,
        criticalIssues: parsed.criticalIssues.length,
        warnings: parsed.warnings.length,
        passedChecks: parsed.passedChecks.length,
        auditTrail: parsed.auditTrail,
        status: ScanStatus.COMPLETED,
      },
    });

    return jsonOk({
      id: scan.id,
      projectName: scan.projectName,
      repositoryUrl: scan.repositoryUrl,
      frameworks: scan.frameworks,
      overallScore: scan.overallScore,
      status: scan.status,
      criticalIssuesCount: scan.criticalIssues,
      warningsCount: scan.warnings,
      passedChecksCount: scan.passedChecks,
      summary: parsed.summary,
      issues: scanResults.issues,
      passedChecks: parsed.passedChecks,
      auditTrail: parsed.auditTrail,
      createdAt: scan.createdAt.toISOString(),
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to run compliance scan."), 500);
  }
}
