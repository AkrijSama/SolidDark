import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { HeirAccessLevel } from "@prisma/client";
import { Resend } from "resend";

import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, getRequiredEnv, jsonError, jsonOk } from "@/lib/utils";

function parseHeirInput(body: Record<string, unknown>) {
  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const relationship = String(body.relationship ?? "").trim();
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const instructions = typeof body.instructions === "string" ? body.instructions.trim() : null;
  const accessLevel = String(body.accessLevel ?? "").trim() as HeirAccessLevel;
  const notificationOrder = Number(body.notificationOrder ?? 1);

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  if (!relationship) {
    throw new Error("Relationship is required.");
  }

  if (!Object.values(HeirAccessLevel).includes(accessLevel)) {
    throw new Error("Access level is invalid.");
  }

  if (!Number.isFinite(notificationOrder) || notificationOrder < 1) {
    throw new Error("Notification order must be a positive number.");
  }

  return {
    fullName,
    email,
    relationship,
    phone,
    instructions,
    accessLevel,
    notificationOrder,
  };
}

async function sendHeirVerificationEmail({
  heirName,
  heirEmail,
  ownerName,
  verificationToken,
}: {
  heirName: string;
  heirEmail: string;
  ownerName: string | null;
  verificationToken: string;
}) {
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const appUrl = getRequiredEnv("NEXT_PUBLIC_APP_URL");

  await resend.emails.send({
    from: "SolidDark <notifications@soliddark.dev>",
    to: heirEmail,
    subject: "Confirm your SolidDark continuity role",
    html: `
      <p>Hello ${heirName},</p>
      <p>${ownerName ?? "A SolidDark user"} listed you as an infrastructure heir.</p>
      <p>Confirm your role here:</p>
      <p><a href="${appUrl}/login?verificationToken=${verificationToken}">${appUrl}/login?verificationToken=${verificationToken}</a></p>
      <p>If you were not expecting this, ignore the message.</p>
    `,
  });
}

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const heirs = await prisma.heir.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        notificationOrder: "asc",
      },
    });

    return jsonOk(
      heirs.map((heir) => ({
        id: heir.id,
        fullName: heir.fullName,
        email: heir.email,
        phone: heir.phone,
        relationship: heir.relationship,
        accessLevel: heir.accessLevel,
        notificationOrder: heir.notificationOrder,
        isVerified: heir.isVerified,
        instructions: heir.instructions,
      })),
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load heirs."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseHeirInput(body);
    const verificationToken = randomUUID();

    const heir = await prisma.heir.create({
      data: {
        userId: user.id,
        ...parsed,
        verificationToken,
      },
    });

    try {
      await sendHeirVerificationEmail({
        heirName: heir.fullName,
        heirEmail: heir.email,
        ownerName: user.fullName,
        verificationToken,
      });
    } catch (error) {
      await prisma.heir.delete({
        where: {
          id: heir.id,
        },
      });

      throw error;
    }

    return jsonOk({
      id: heir.id,
      fullName: heir.fullName,
      email: heir.email,
      phone: heir.phone,
      relationship: heir.relationship,
      accessLevel: heir.accessLevel,
      notificationOrder: heir.notificationOrder,
      isVerified: heir.isVerified,
      instructions: heir.instructions,
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to create heir."), 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();

    if (!id) {
      return jsonError("Heir id is required.", 400);
    }

    const existingHeir = await prisma.heir.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingHeir) {
      return jsonError("Heir not found.", 404);
    }

    const parsed = parseHeirInput(body);
    const heir = await prisma.heir.update({
      where: {
        id: existingHeir.id,
      },
      data: parsed,
    });

    return jsonOk({
      id: heir.id,
      fullName: heir.fullName,
      email: heir.email,
      phone: heir.phone,
      relationship: heir.relationship,
      accessLevel: heir.accessLevel,
      notificationOrder: heir.notificationOrder,
      isVerified: heir.isVerified,
      instructions: heir.instructions,
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to update heir."), 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return jsonError("Heir id is required.", 400);
    }

    const heir = await prisma.heir.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!heir) {
      return jsonError("Heir not found.", 404);
    }

    await prisma.heir.delete({
      where: {
        id: heir.id,
      },
    });

    return jsonOk({ id: heir.id });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to delete heir."), 500);
  }
}
