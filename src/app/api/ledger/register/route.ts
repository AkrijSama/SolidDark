import type { NextRequest } from "next/server";

import { LedgerStatus, Prisma } from "@prisma/client";

import { hashEvidenceBundle, signWorkEntry } from "@/lib/crypto/ledger";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, jsonError, jsonOk } from "@/lib/utils";

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const entries = await prisma.workEntry.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return jsonOk(
      entries.map((entry) => ({
        id: entry.id,
        projectName: entry.projectName,
        description: entry.description,
        deploymentUrl: entry.deploymentUrl,
        repositoryUrl: entry.repositoryUrl,
        platform: entry.platform,
        techStack: entry.techStack,
        evidenceHash: entry.evidenceHash,
        signature: entry.signature,
        publicKey: entry.publicKey,
        metrics: entry.metrics as Record<string, unknown> | null,
        verifiedAt: entry.verifiedAt?.toISOString() ?? null,
        verificationMethod: entry.verificationMethod,
        status: entry.status,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load work entries."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const projectName = String(body.projectName ?? "").trim();
    const description = String(body.description ?? "").trim();
    const deploymentUrl = String(body.deploymentUrl ?? "").trim() || null;
    const repositoryUrl = String(body.repositoryUrl ?? "").trim() || null;
    const platform = String(body.platform ?? "").trim() || null;
    const techStack = Array.isArray(body.techStack)
      ? body.techStack.map((item) => String(item)).filter(Boolean)
      : String(body.techStack ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    const metrics = typeof body.metrics === "object" && body.metrics ? (body.metrics as Record<string, unknown>) : null;

    if (!projectName || !description || techStack.length === 0) {
      return jsonError("Project name, description, and tech stack are required.", 400);
    }

    const signablePayload = {
      projectName,
      description,
      deploymentUrl,
      repositoryUrl,
      platform,
      techStack,
      metrics,
    };
    const evidenceHash = hashEvidenceBundle(JSON.stringify(signablePayload));
    const { signature, publicKey } = signWorkEntry(user.id, {
      ...signablePayload,
      evidenceHash,
    });

    const entry = await prisma.workEntry.create({
      data: {
        userId: user.id,
        projectName,
        description,
        deploymentUrl,
        repositoryUrl,
        platform,
        techStack,
        evidenceHash,
        signature,
        publicKey,
        metrics: metrics ? (metrics as Prisma.InputJsonValue) : undefined,
        status: LedgerStatus.PENDING,
      },
    });

    return jsonOk({
      id: entry.id,
      projectName: entry.projectName,
      description: entry.description,
      deploymentUrl: entry.deploymentUrl,
      repositoryUrl: entry.repositoryUrl,
      platform: entry.platform,
      techStack: entry.techStack,
      evidenceHash: entry.evidenceHash,
      signature: entry.signature,
      publicKey: entry.publicKey,
      metrics: entry.metrics as Record<string, unknown> | null,
      verifiedAt: entry.verifiedAt?.toISOString() ?? null,
      verificationMethod: entry.verificationMethod,
      status: entry.status,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to register work entry."), 500);
  }
}
