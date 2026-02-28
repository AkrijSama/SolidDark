import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, jsonError, jsonOk } from "@/lib/utils";

export async function POST() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const config = await prisma.deadmanConfig.upsert({
      where: {
        userId: user.id,
      },
      update: {
        lastCheckIn: new Date(),
        escalationStage: 0,
      },
      create: {
        userId: user.id,
        isEnabled: true,
        lastCheckIn: new Date(),
        escalationStage: 0,
      },
    });

    return jsonOk({
      id: config.id,
      lastCheckIn: config.lastCheckIn.toISOString(),
      escalationStage: config.escalationStage,
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to record dead-man check-in."), 500);
  }
}
