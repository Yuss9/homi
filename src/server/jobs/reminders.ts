import "server-only";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "../../../db";
import {
  homeMembers,
  maintenanceTasks,
  notificationPreferences,
  notifications,
  reminderDeliveries,
  user,
} from "../../../db/schema";
import { enabledChannels, shouldSendReminder } from "../../features/notifications/preferences";
import { reminderIdempotencyKey } from "../../features/notifications/idempotency";
import { sendEmail } from "../email";
import { reminderEmail } from "../email/templates";
import { getEnv } from "../env";
import { logger } from "../logger";

export async function processReminders(now = new Date(), batchSize = 100) {
  const horizon = new Date(now.getTime() + 45 * 86_400_000);
  const candidates = await db
    .select({
      task: maintenanceTasks,
      memberUserId: homeMembers.userId,
      email: user.email,
      emailEnabled: notificationPreferences.emailEnabled,
      inAppEnabled: notificationPreferences.inAppEnabled,
      maintenanceReminderDays: notificationPreferences.maintenanceReminderDays,
      warrantyReminderDays: notificationPreferences.warrantyReminderDays,
      documentExpiryReminderDays: notificationPreferences.documentExpiryReminderDays,
      timezone: notificationPreferences.timezone,
    })
    .from(maintenanceTasks)
    .innerJoin(homeMembers, eq(homeMembers.homeId, maintenanceTasks.homeId))
    .innerJoin(user, eq(user.id, homeMembers.userId))
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, homeMembers.userId))
    .where(
      and(
        isNull(maintenanceTasks.archivedAt),
        gte(maintenanceTasks.nextDueAt, new Date(now.getTime() - 86_400_000)),
        lte(maintenanceTasks.nextDueAt, horizon),
      ),
    )
    .limit(batchSize);

  let delivered = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of candidates) {
    const preference = {
      emailEnabled: item.emailEnabled ?? true,
      inAppEnabled: item.inAppEnabled ?? true,
      maintenanceReminderDays: item.maintenanceReminderDays ?? 7,
      warrantyReminderDays: item.warrantyReminderDays ?? 30,
      documentExpiryReminderDays: item.documentExpiryReminderDays ?? 30,
    };
    if (!shouldSendReminder(preference, "MAINTENANCE", item.task.nextDueAt, now)) {
      skipped += 1;
      continue;
    }
    for (const channel of enabledChannels(preference)) {
      const idempotencyKey = reminderIdempotencyKey({
        userId: item.memberUserId,
        entityType: "MAINTENANCE_TASK",
        entityId: item.task.id,
        reminderType: "DUE_SOON",
        channel,
        scheduledFor: now,
      });
      const [delivery] = await db
        .insert(reminderDeliveries)
        .values({
          userId: item.memberUserId,
          entityType: "MAINTENANCE_TASK",
          entityId: item.task.id,
          reminderType: "DUE_SOON",
          scheduledFor: now,
          channel,
          idempotencyKey,
        })
        .onConflictDoNothing({ target: reminderDeliveries.idempotencyKey })
        .returning();
      if (!delivery) {
        skipped += 1;
        continue;
      }
      try {
        const formattedDue = new Intl.DateTimeFormat("en", {
          dateStyle: "medium",
          timeZone: item.timezone ?? "UTC",
        }).format(item.task.nextDueAt);
        if (channel === "IN_APP") {
          await db.insert(notifications).values({
            userId: item.memberUserId,
            homeId: item.task.homeId,
            type: "MAINTENANCE_DUE_SOON",
            title: item.task.title,
            message: `Due ${formattedDue}`,
            actionUrl: `/maintenance/${item.task.id}`,
          });
        } else {
          await sendEmail(
            item.email,
            reminderEmail(
              `${item.task.title} is coming up`,
              `This home maintenance task is due ${formattedDue}.`,
              `${getEnv().NEXT_PUBLIC_APP_URL}/maintenance/${item.task.id}`,
            ),
          );
        }
        await db
          .update(reminderDeliveries)
          .set({ status: "DELIVERED", deliveredAt: new Date() })
          .where(eq(reminderDeliveries.id, delivery.id));
        delivered += 1;
      } catch (error) {
        failed += 1;
        await db
          .update(reminderDeliveries)
          .set({ status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" })
          .where(eq(reminderDeliveries.id, delivery.id));
        logger.error({ deliveryId: delivery.id, error }, "reminder_delivery_failed");
      }
    }
  }
  return { candidates: candidates.length, delivered, skipped, failed };
}

