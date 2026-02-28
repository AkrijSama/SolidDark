import type { NextRequest } from "next/server";
import { ProjectStatus } from "@prisma/client";

import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, jsonError, jsonOk } from "@/lib/utils";

async function getCurrentCollectiveId(userId: string) {
  const prisma = getPrismaClient();
  const membership = await prisma.collectiveMember.findFirst({
    where: { userId },
  });
  return membership?.collectiveId ?? null;
}

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const collectiveId = await getCurrentCollectiveId(user.id);

    if (!collectiveId) {
      return jsonOk([]);
    }

    const projects = await prisma.collectiveProject.findMany({
      where: { collectiveId },
      orderBy: { updatedAt: "desc" },
    });

    return jsonOk(
      projects.map((project) => ({
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
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load collective projects."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const collectiveId = await getCurrentCollectiveId(user.id);
    const body = (await request.json()) as Record<string, unknown>;

    if (!collectiveId) {
      return jsonError("Create or join a collective before adding projects.", 400);
    }

    const name = String(body.name ?? "").trim();
    const clientName = String(body.clientName ?? "").trim() || null;
    const contractValue = String(body.contractValue ?? "").trim();
    const status = String(body.status ?? "PROPOSED").trim() as ProjectStatus;
    const revenueWaterfall = Array.isArray(body.revenueWaterfall)
      ? body.revenueWaterfall
      : String(body.revenueWaterfall ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => {
            const [label, percentage] = item.split(":");
            return { label: label.trim(), percentage: Number(percentage) || 0 };
          });

    if (!name || !Object.values(ProjectStatus).includes(status)) {
      return jsonError("Project name and valid status are required.", 400);
    }

    const project = await prisma.collectiveProject.create({
      data: {
        collectiveId,
        name,
        clientName,
        contractValue: contractValue ? Number(contractValue) : undefined,
        status,
        revenueWaterfall,
      },
    });

    return jsonOk({
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
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to create collective project."), 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const collectiveId = await getCurrentCollectiveId(user.id);
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();

    if (!collectiveId || !id) {
      return jsonError("Collective project id is required.", 400);
    }

    const project = await prisma.collectiveProject.findFirst({
      where: { id, collectiveId },
    });

    if (!project) {
      return jsonError("Project not found.", 404);
    }

    const revenueWaterfall = Array.isArray(body.revenueWaterfall)
      ? body.revenueWaterfall
      : String(body.revenueWaterfall ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => {
            const [label, percentage] = item.split(":");
            return { label: label.trim(), percentage: Number(percentage) || 0 };
          });

    const updated = await prisma.collectiveProject.update({
      where: { id: project.id },
      data: {
        name: String(body.name ?? project.name).trim(),
        clientName: String(body.clientName ?? project.clientName ?? "").trim() || null,
        contractValue: String(body.contractValue ?? project.contractValue?.toString() ?? "").trim()
          ? Number(String(body.contractValue ?? project.contractValue?.toString()))
          : undefined,
        status: String(body.status ?? project.status).trim() as ProjectStatus,
        revenueWaterfall,
      },
    });

    return jsonOk({ id: updated.id, status: updated.status });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to update collective project."), 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const collectiveId = await getCurrentCollectiveId(user.id);
    const id = request.nextUrl.searchParams.get("id");

    if (!collectiveId || !id) {
      return jsonError("Project id is required.", 400);
    }

    const project = await prisma.collectiveProject.findFirst({
      where: { id, collectiveId },
    });

    if (!project) {
      return jsonError("Project not found.", 404);
    }

    await prisma.collectiveProject.delete({
      where: { id: project.id },
    });

    return jsonOk({ id: project.id });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to delete collective project."), 500);
  }
}
