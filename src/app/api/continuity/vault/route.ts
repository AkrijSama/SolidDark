import type { NextRequest } from "next/server";

import { ServiceType } from "@prisma/client";

import { decrypt, encrypt } from "@/lib/crypto/vault";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import type { VaultPayload } from "@/lib/types";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, jsonError, jsonOk } from "@/lib/utils";

function parseVaultPayload(body: Record<string, unknown>) {
  const serviceName = String(body.serviceName ?? "").trim();
  const serviceType = String(body.serviceType ?? "").trim() as ServiceType;
  const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
  const accessibleBy = Array.isArray(body.accessibleBy) ? body.accessibleBy.map((value) => String(value)) : [];

  if (!serviceName) {
    throw new Error("Service name is required.");
  }

  if (!Object.values(ServiceType).includes(serviceType)) {
    throw new Error("Service type is invalid.");
  }

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error("Expiration date is invalid.");
  }

  const payload: VaultPayload = {
    username: typeof body.username === "string" ? body.username : undefined,
    password: typeof body.password === "string" ? body.password : undefined,
    apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  };

  return {
    serviceName,
    serviceType,
    expiresAt,
    accessibleBy,
    payload,
  };
}

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const entryId = request.nextUrl.searchParams.get("entryId");
    const reveal = request.nextUrl.searchParams.get("reveal") === "true";

    if (entryId && reveal) {
      const entry = await prisma.vaultEntry.findFirst({
        where: {
          id: entryId,
          userId: user.id,
        },
      });

      if (!entry) {
        return jsonError("Vault entry not found.", 404);
      }

      const decrypted = JSON.parse(decrypt(entry.encryptedData, entry.nonce)) as VaultPayload;

      return jsonOk({
        id: entry.id,
        serviceName: entry.serviceName,
        serviceType: entry.serviceType,
        lastRotated: entry.lastRotated?.toISOString() ?? null,
        expiresAt: entry.expiresAt?.toISOString() ?? null,
        accessibleBy: entry.accessibleBy,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        data: decrypted,
      });
    }

    const entries = await prisma.vaultEntry.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return jsonOk(
      entries.map((entry) => ({
        id: entry.id,
        serviceName: entry.serviceName,
        serviceType: entry.serviceType,
        lastRotated: entry.lastRotated?.toISOString() ?? null,
        expiresAt: entry.expiresAt?.toISOString() ?? null,
        accessibleBy: entry.accessibleBy,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load vault entries."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseVaultPayload(body);
    const encrypted = encrypt(JSON.stringify(parsed.payload));

    const entry = await prisma.vaultEntry.create({
      data: {
        userId: user.id,
        serviceName: parsed.serviceName,
        serviceType: parsed.serviceType,
        encryptedData: encrypted.encrypted,
        nonce: encrypted.nonce,
        expiresAt: parsed.expiresAt,
        accessibleBy: parsed.accessibleBy,
        lastRotated: new Date(),
      },
    });

    return jsonOk({
      id: entry.id,
      serviceName: entry.serviceName,
      serviceType: entry.serviceType,
      lastRotated: entry.lastRotated?.toISOString() ?? null,
      expiresAt: entry.expiresAt?.toISOString() ?? null,
      accessibleBy: entry.accessibleBy,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to create vault entry."), 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const entryId = String(body.id ?? "").trim();

    if (!entryId) {
      return jsonError("Vault entry id is required.", 400);
    }

    const existingEntry = await prisma.vaultEntry.findFirst({
      where: {
        id: entryId,
        userId: user.id,
      },
    });

    if (!existingEntry) {
      return jsonError("Vault entry not found.", 404);
    }

    const parsed = parseVaultPayload(body);
    const encrypted = encrypt(JSON.stringify(parsed.payload));

    const updatedEntry = await prisma.vaultEntry.update({
      where: {
        id: existingEntry.id,
      },
      data: {
        serviceName: parsed.serviceName,
        serviceType: parsed.serviceType,
        encryptedData: encrypted.encrypted,
        nonce: encrypted.nonce,
        expiresAt: parsed.expiresAt,
        accessibleBy: parsed.accessibleBy,
        lastRotated: new Date(),
      },
    });

    return jsonOk({
      id: updatedEntry.id,
      serviceName: updatedEntry.serviceName,
      serviceType: updatedEntry.serviceType,
      lastRotated: updatedEntry.lastRotated?.toISOString() ?? null,
      expiresAt: updatedEntry.expiresAt?.toISOString() ?? null,
      accessibleBy: updatedEntry.accessibleBy,
      createdAt: updatedEntry.createdAt.toISOString(),
      updatedAt: updatedEntry.updatedAt.toISOString(),
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to update vault entry."), 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const entryId = request.nextUrl.searchParams.get("id");

    if (!entryId) {
      return jsonError("Vault entry id is required.", 400);
    }

    const existingEntry = await prisma.vaultEntry.findFirst({
      where: {
        id: entryId,
        userId: user.id,
      },
    });

    if (!existingEntry) {
      return jsonError("Vault entry not found.", 404);
    }

    await prisma.vaultEntry.delete({
      where: {
        id: existingEntry.id,
      },
    });

    return jsonOk({ id: existingEntry.id });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to delete vault entry."), 500);
  }
}
