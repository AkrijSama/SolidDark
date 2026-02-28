import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { PolicyStatus, PolicyType } from "@prisma/client";

import { RISK_ASSESS_PROMPT } from "@/lib/ai/prompts/risk-assess";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, extractJsonFromText, getRequiredEnv, jsonError, jsonOk } from "@/lib/utils";

type RiskResponse = {
  summary: string;
  riskScore: number;
  premiumMonthlyEstimate: number;
  premiumAnnualEstimate: number;
  coverageLimitSuggestion: number;
  deductibleSuggestion: number;
  keyRiskFactors: Array<{ label: string; severity: "low" | "medium" | "high"; explanation: string }>;
};

function createPolicyNumber() {
  return `SD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

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
    return jsonError(createApiError(error, "Unable to load insurance assessments."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const applicationUrl = String(body.applicationUrl ?? "").trim();
    const policyType = String(body.policyType ?? "AI_SOFTWARE_EO").trim() as PolicyType;
    const techStack = String(body.techStack ?? "").trim();
    const userCount = String(body.userCount ?? "").trim();
    const dataTypes = String(body.dataTypes ?? "").trim();

    if (!applicationUrl || !Object.values(PolicyType).includes(policyType)) {
      return jsonError("Application URL and valid policy type are required.", 400);
    }

    const anthropic = new Anthropic({
      apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    });

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1800,
      temperature: 0.2,
      system: RISK_ASSESS_PROMPT,
      messages: [
        {
          role: "user",
          content: `Application URL: ${applicationUrl}\nPolicy type: ${policyType}\nTech stack: ${techStack}\nUsers: ${userCount}\nData types handled: ${dataTypes}\n\nReturn the requested JSON only.`,
        },
      ],
    });

    const text = completion.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
    const parsed = extractJsonFromText<RiskResponse>(text);
    const riskFactors = {
      summary: parsed.summary,
      factors: parsed.keyRiskFactors,
      inputs: {
        techStack,
        userCount,
        dataTypes,
      },
    };

    const policy = await prisma.insurancePolicy.create({
      data: {
        userId: user.id,
        policyNumber: createPolicyNumber(),
        policyType,
        applicationUrl,
        riskScore: parsed.riskScore,
        riskFactors,
        premiumMonthly: parsed.premiumMonthlyEstimate,
        premiumAnnual: parsed.premiumAnnualEstimate,
        coverageLimit: parsed.coverageLimitSuggestion,
        deductible: parsed.deductibleSuggestion,
        status: PolicyStatus.QUOTE,
      },
    });

    return jsonOk({
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
      summary: parsed.summary,
      riskFactors: parsed.keyRiskFactors,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to assess insurance risk."), 500);
  }
}
