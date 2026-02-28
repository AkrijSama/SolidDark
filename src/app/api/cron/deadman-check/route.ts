import { Resend } from "resend";

import { getPrismaClient } from "@/lib/prisma";
import { getRequiredEnv, jsonError, jsonOk } from "@/lib/utils";

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));

  await resend.emails.send({
    from: "SolidDark <notifications@soliddark.dev>",
    to,
    subject,
    html,
  });
}

export async function GET(request: Request) {
  try {
    const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");

    if (headerSecret !== getRequiredEnv("CRON_SECRET")) {
      return jsonError("Unauthorized cron request.", 401);
    }

    const prisma = getPrismaClient();
    const now = new Date();
    const configs = await prisma.deadmanConfig.findMany({
      where: {
        isEnabled: true,
      },
      include: {
        user: {
          include: {
            heirs: {
              orderBy: {
                notificationOrder: "asc",
              },
            },
          },
        },
      },
    });

    const results: Array<{ userId: string; action: string }> = [];

    for (const config of configs) {
      const warningAt = new Date(config.lastCheckIn.getTime() + config.checkIntervalHours * 60 * 60 * 1000);
      const heirNotifyAt = new Date(warningAt.getTime() + config.gracePeriodHours * 60 * 60 * 1000);

      if (now >= heirNotifyAt && config.escalationStage < 2) {
        for (const heir of config.user.heirs) {
          await sendEmail({
            to: heir.email,
            subject: `SolidDark continuity alert for ${config.user.fullName ?? config.user.email}`,
            html: `
              <p>Hello ${heir.fullName},</p>
              <p>SolidDark detected a missed continuity check-in for ${config.user.fullName ?? config.user.email}.</p>
              <p>Your current access level is ${heir.accessLevel}.</p>
              <p>Review the continuity plan and be ready to act on the instructions already shared with you.</p>
            `,
          });
        }

        await prisma.deadmanConfig.update({
          where: {
            id: config.id,
          },
          data: {
            escalationStage: 2,
          },
        });

        results.push({ userId: config.userId, action: "heirs_notified" });
        continue;
      }

      if (now >= warningAt && config.escalationStage < 1) {
        if (config.alertEmail) {
          await sendEmail({
            to: config.user.email,
            subject: "SolidDark dead-man warning",
            html: `
              <p>Hello ${config.user.fullName ?? config.user.email},</p>
              <p>You missed your SolidDark continuity check-in window.</p>
              <p>Check in now to avoid notifying your heirs.</p>
            `,
          });
        }

        await prisma.deadmanConfig.update({
          where: {
            id: config.id,
          },
          data: {
            escalationStage: 1,
          },
        });

        results.push({ userId: config.userId, action: "warning_sent" });
      } else if (now >= heirNotifyAt && config.escalationStage === 2) {
        await prisma.deadmanConfig.update({
          where: {
            id: config.id,
          },
          data: {
            escalationStage: 3,
          },
        });

        results.push({ userId: config.userId, action: "activated" });
      }
    }

    return jsonOk({
      processed: configs.length,
      results,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Dead-man cron failed.", 500);
  }
}
