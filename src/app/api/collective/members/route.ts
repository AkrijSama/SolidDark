import type { NextRequest } from "next/server";
import { CollectiveStatus, EntityType, MemberRole } from "@prisma/client";

import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, jsonError, jsonOk } from "@/lib/utils";

async function getPrimaryCollectiveForUser(userId: string) {
  const prisma = getPrismaClient();
  return prisma.collectiveMember.findFirst({
    where: { userId },
    include: {
      collective: {
        include: {
          members: {
            include: {
              user: true,
            },
            orderBy: {
              joinedAt: "asc",
            },
          },
          projects: {
            orderBy: {
              updatedAt: "desc",
            },
          },
        },
      },
    },
  });
}

export async function GET() {
  try {
    const { user } = await requireAuthenticatedAppUser();
    const membership = await getPrimaryCollectiveForUser(user.id);

    if (!membership) {
      return jsonOk(null);
    }

    return jsonOk({
      id: membership.collective.id,
      name: membership.collective.name,
      description: membership.collective.description,
      entityType: membership.collective.entityType,
      entityState: membership.collective.entityState,
      status: membership.collective.status,
      members: membership.collective.members.map((member) => ({
        id: member.id,
        userId: member.userId,
        collectiveId: member.collectiveId,
        fullName: member.user.fullName,
        email: member.user.email,
        role: member.role,
        revenueShare: member.revenueShare?.toString() ?? null,
        skills: member.skills,
        joinedAt: member.joinedAt.toISOString(),
      })),
      projects: membership.collective.projects.map((project) => ({
        id: project.id,
        collectiveId: project.collectiveId,
        name: project.name,
        clientName: project.clientName,
        contractValue: project.contractValue?.toString() ?? null,
        status: project.status,
        startDate: project.startDate?.toISOString() ?? null,
        endDate: project.endDate?.toISOString() ?? null,
        revenueWaterfall: (project.revenueWaterfall as Array<{ label: string; percentage: number }> | null) ?? [],
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load collective members."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const mode = String(body.mode ?? "create").trim();

    if (mode === "create") {
      const name = String(body.name ?? "").trim();
      const description = String(body.description ?? "").trim() || null;
      const entityType = String(body.entityType ?? "").trim() as EntityType | "";
      const entityState = String(body.entityState ?? "").trim() || null;
      const skills = String(body.skills ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (!name) {
        return jsonError("Collective name is required.", 400);
      }

      const collective = await prisma.collective.create({
        data: {
          name,
          description,
          entityType: entityType || undefined,
          entityState,
          status: CollectiveStatus.FORMING,
          members: {
            create: {
              userId: user.id,
              role: MemberRole.ADMIN,
              skills,
            },
          },
        },
      });

      return jsonOk({ id: collective.id, name: collective.name });
    }

    if (mode === "join") {
      const collectiveId = String(body.collectiveId ?? "").trim();
      const role = String(body.role ?? "MEMBER").trim() as MemberRole;
      const skills = String(body.skills ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (!collectiveId) {
        return jsonError("Collective id is required to join.", 400);
      }

      const collective = await prisma.collective.findUnique({
        where: { id: collectiveId },
      });

      if (!collective) {
        return jsonError("Collective not found.", 404);
      }

      const member = await prisma.collectiveMember.upsert({
        where: {
          userId_collectiveId: {
            userId: user.id,
            collectiveId,
          },
        },
        update: {
          role,
          skills,
        },
        create: {
          userId: user.id,
          collectiveId,
          role,
          skills,
        },
      });

      return jsonOk({ id: member.id, collectiveId: member.collectiveId });
    }

    return jsonError("Invalid collective member action.", 400);
  } catch (error) {
    return jsonError(createApiError(error, "Unable to save collective membership."), 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const role = String(body.role ?? "MEMBER").trim() as MemberRole;
    const revenueShare = String(body.revenueShare ?? "").trim();
    const skills = String(body.skills ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!id) {
      return jsonError("Member id is required.", 400);
    }

    const membership = await getPrimaryCollectiveForUser(user.id);

    if (!membership) {
      return jsonError("You are not part of a collective.", 404);
    }

    const member = await prisma.collectiveMember.findFirst({
      where: {
        id,
        collectiveId: membership.collectiveId,
      },
    });

    if (!member) {
      return jsonError("Collective member not found.", 404);
    }

    const updated = await prisma.collectiveMember.update({
      where: { id: member.id },
      data: {
        role,
        revenueShare: revenueShare ? Number(revenueShare) : undefined,
        skills,
      },
    });

    return jsonOk({ id: updated.id, role: updated.role });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to update collective member."), 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return jsonError("Member id is required.", 400);
    }

    const membership = await getPrimaryCollectiveForUser(user.id);
    if (!membership) {
      return jsonError("You are not part of a collective.", 404);
    }

    const member = await prisma.collectiveMember.findFirst({
      where: { id, collectiveId: membership.collectiveId },
    });

    if (!member) {
      return jsonError("Collective member not found.", 404);
    }

    await prisma.collectiveMember.delete({
      where: { id: member.id },
    });

    return jsonOk({ id: member.id });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to delete collective member."), 500);
  }
}
