import type { NextRequest } from "next/server";

import { LedgerStatus } from "@prisma/client";

import { verifyWorkEntrySignature } from "@/lib/crypto/ledger";
import { getPrismaClient } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return jsonError("Work entry id is required.", 400);
    }

    const entry = await prisma.workEntry.findUnique({
      where: {
        id,
      },
    });

    if (!entry) {
      return jsonError("Work entry not found.", 404);
    }

    const signatureValid = verifyWorkEntrySignature(
      {
        projectName: entry.projectName,
        description: entry.description,
        deploymentUrl: entry.deploymentUrl,
        repositoryUrl: entry.repositoryUrl,
        platform: entry.platform,
        techStack: entry.techStack,
        metrics: entry.metrics as Record<string, unknown> | null,
        evidenceHash: entry.evidenceHash,
      },
      entry.signature,
      entry.publicKey,
    );

    return jsonOk({
      id: entry.id,
      projectName: entry.projectName,
      status: entry.status,
      signatureValid,
      verificationMethod: entry.verificationMethod,
      verifiedAt: entry.verifiedAt?.toISOString() ?? null,
      evidenceHash: entry.evidenceHash,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to verify work entry.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const verificationMethod = String(body.verificationMethod ?? "manual").trim();

    if (!id) {
      return jsonError("Work entry id is required.", 400);
    }

    const entry = await prisma.workEntry.findUnique({
      where: {
        id,
      },
    });

    if (!entry) {
      return jsonError("Work entry not found.", 404);
    }

    const signatureValid = verifyWorkEntrySignature(
      {
        projectName: entry.projectName,
        description: entry.description,
        deploymentUrl: entry.deploymentUrl,
        repositoryUrl: entry.repositoryUrl,
        platform: entry.platform,
        techStack: entry.techStack,
        metrics: entry.metrics as Record<string, unknown> | null,
        evidenceHash: entry.evidenceHash,
      },
      entry.signature,
      entry.publicKey,
    );

    if (!signatureValid) {
      return jsonError("Signature verification failed. This entry should not be marked verified.", 400);
    }

    const updated = await prisma.workEntry.update({
      where: {
        id: entry.id,
      },
      data: {
        status: LedgerStatus.VERIFIED,
        verifiedAt: new Date(),
        verificationMethod,
      },
    });

    return jsonOk({
      id: updated.id,
      status: updated.status,
      verifiedAt: updated.verifiedAt?.toISOString() ?? null,
      verificationMethod: updated.verificationMethod,
      signatureValid,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to mark work entry verified.", 500);
  }
}
