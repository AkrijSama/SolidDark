import type { NextRequest } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, jsonError, jsonOk } from "@/lib/utils";

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const config = await prisma.deadmanConfig.findUnique({
      where: {
        userId: user.id,
      },
    });

    return jsonOk(
      config
        ? {
            id: config.id,
            isEnabled: config.isEnabled,
            checkIntervalHours: config.checkIntervalHours,
            lastCheckIn: config.lastCheckIn.toISOString(),
            gracePeriodHours: config.gracePeriodHours,
            escalationStage: config.escalationStage,
            alertEmail: config.alertEmail,
            alertSms: config.alertSms,
            alertPhone: config.alertPhone,
          }
        : null,
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load dead-man configuration."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as Record<string, unknown>;

    const checkIntervalHours = Number(body.checkIntervalHours ?? 72);
    const gracePeriodHours = Number(body.gracePeriodHours ?? 24);

    if (!Number.isFinite(checkIntervalHours) || checkIntervalHours < 1) {
      return jsonError("Check-in interval must be a valid number of hours.", 400);
    }

    if (!Number.isFinite(gracePeriodHours) || gracePeriodHours < 1) {
      return jsonError("Grace period must be a valid number of hours.", 400);
    }

    const config = await prisma.deadmanConfig.upsert({
      where: {
        userId: user.id,
      },
      update: {
        isEnabled: Boolean(body.isEnabled),
        checkIntervalHours,
        gracePeriodHours,
        alertEmail: body.alertEmail !== false,
        alertSms: Boolean(body.alertSms),
        alertPhone: typeof body.alertPhone === "string" ? body.alertPhone.trim() : null,
      },
      create: {
        userId: user.id,
        isEnabled: Boolean(body.isEnabled),
        checkIntervalHours,
        gracePeriodHours,
        alertEmail: body.alertEmail !== false,
        alertSms: Boolean(body.alertSms),
        alertPhone: typeof body.alertPhone === "string" ? body.alertPhone.trim() : null,
      },
    });

    return jsonOk({
      id: config.id,
      isEnabled: config.isEnabled,
      checkIntervalHours: config.checkIntervalHours,
      lastCheckIn: config.lastCheckIn.toISOString(),
      gracePeriodHours: config.gracePeriodHours,
      escalationStage: config.escalationStage,
      alertEmail: config.alertEmail,
      alertSms: config.alertSms,
      alertPhone: config.alertPhone,
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to save dead-man configuration."), 500);
  }
}
