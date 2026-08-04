import "server-only";

import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";
import { db } from "../../../db";
import {
  assets,
  documents,
  homeMembers,
  homes,
  maintenanceTasks,
  notificationPreferences,
  notifications,
  reminderDeliveries,
  repairRecords,
  user,
} from "../../../db/schema";
import { reminderIdempotencyKey } from "../../features/notifications/idempotency";
import {
  enabledChannels,
  reminderWindowDays,
  shouldSendReminder,
  type Preference,
  type ReminderKind,
} from "../../features/notifications/preferences";
import { sendEmail } from "../email";
import { reminderEmail } from "../email/templates";
import { getEnv } from "../env";
import { logger } from "../logger";

const dayMs = 86_400_000;

type DeliveryStats = { delivered: number; skipped: number; failed: number };
type DeliveryInput = {
  userId: string;
  email: string;
  homeId?: string | null;
  entityType: string;
  entityId: string;
  reminderType: string;
  scheduledFor: Date;
  preference: Preference;
  title: string;
  message: string;
  actionUrl: string;
};

type PreferenceRow = {
  emailEnabled: boolean | null;
  inAppEnabled: boolean | null;
  maintenanceReminderDays: number | null;
  warrantyReminderDays: number | null;
  documentExpiryReminderDays: number | null;
};

function preferenceFrom(row: PreferenceRow): Preference {
  return {
    emailEnabled: row.emailEnabled ?? true,
    inAppEnabled: row.inAppEnabled ?? true,
    maintenanceReminderDays: row.maintenanceReminderDays ?? 7,
    warrantyReminderDays: row.warrantyReminderDays ?? 30,
    documentExpiryReminderDays: row.documentExpiryReminderDays ?? 30,
  };
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function databaseDate(value: string | Date) {
  return value instanceof Date
    ? value
    : new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
}

function reminderSchedule(
  preference: Preference,
  kind: ReminderKind,
  dueAt: Date,
) {
  return new Date(dueAt.getTime() - reminderWindowDays(preference, kind) * dayMs);
}

function utcWeekStart(now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  return start;
}

async function deliver(input: DeliveryInput): Promise<DeliveryStats> {
  const stats: DeliveryStats = { delivered: 0, skipped: 0, failed: 0 };
  for (const channel of enabledChannels(input.preference)) {
    const idempotencyKey = reminderIdempotencyKey({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      reminderType: input.reminderType,
      channel,
      scheduledFor: input.scheduledFor,
    });
    const [delivery] = await db
      .insert(reminderDeliveries)
      .values({
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        reminderType: input.reminderType,
        scheduledFor: input.scheduledFor,
        channel,
        idempotencyKey,
      })
      .onConflictDoNothing({ target: reminderDeliveries.idempotencyKey })
      .returning();
    if (!delivery) {
      stats.skipped += 1;
      continue;
    }

    try {
      if (channel === "IN_APP") {
        await db.insert(notifications).values({
          userId: input.userId,
          homeId: input.homeId,
          type: input.reminderType,
          title: input.title,
          message: input.message,
          actionUrl: input.actionUrl,
        });
      } else {
        await sendEmail(
          input.email,
          reminderEmail(
            input.title,
            input.message,
            `${getEnv().NEXT_PUBLIC_APP_URL}${input.actionUrl}`,
          ),
        );
      }
      await db
        .update(reminderDeliveries)
        .set({ status: "DELIVERED", deliveredAt: new Date() })
        .where(eq(reminderDeliveries.id, delivery.id));
      stats.delivered += 1;
    } catch (error) {
      stats.failed += 1;
      await db
        .update(reminderDeliveries)
        .set({
          status: "FAILED",
          error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Unknown error",
        })
        .where(eq(reminderDeliveries.id, delivery.id));
      logger.error(
        { deliveryId: delivery.id, error },
        "reminder_delivery_failed",
      );
    }
  }
  return stats;
}

function addStats(total: DeliveryStats, next: DeliveryStats) {
  total.delivered += next.delivered;
  total.skipped += next.skipped;
  total.failed += next.failed;
}

export async function processReminders(now = new Date(), batchSize = 100) {
  const horizon = new Date(now.getTime() + 45 * dayMs);
  const lowerDate = dateOnly(new Date(now.getTime() - dayMs));
  const upperDate = dateOnly(horizon);
  const total: DeliveryStats = { delivered: 0, skipped: 0, failed: 0 };

  const maintenanceCandidates = await db
    .select({
      task: maintenanceTasks,
      memberUserId: homeMembers.userId,
      email: user.email,
      emailEnabled: notificationPreferences.emailEnabled,
      inAppEnabled: notificationPreferences.inAppEnabled,
      maintenanceReminderDays:
        notificationPreferences.maintenanceReminderDays,
      warrantyReminderDays: notificationPreferences.warrantyReminderDays,
      documentExpiryReminderDays:
        notificationPreferences.documentExpiryReminderDays,
      timezone: notificationPreferences.timezone,
    })
    .from(maintenanceTasks)
    .innerJoin(homeMembers, eq(homeMembers.homeId, maintenanceTasks.homeId))
    .innerJoin(user, eq(user.id, homeMembers.userId))
    .leftJoin(
      notificationPreferences,
      eq(notificationPreferences.userId, homeMembers.userId),
    )
    .where(
      and(
        isNull(maintenanceTasks.archivedAt),
        gte(maintenanceTasks.nextDueAt, new Date(now.getTime() - dayMs)),
        lte(maintenanceTasks.nextDueAt, horizon),
      ),
    )
    .limit(batchSize);

  for (const item of maintenanceCandidates) {
    const preference = preferenceFrom(item);
    if (
      !shouldSendReminder(
        preference,
        "MAINTENANCE",
        item.task.nextDueAt,
        now,
      )
    ) {
      total.skipped += 1;
      continue;
    }
    const formattedDue = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: item.timezone ?? "UTC",
    }).format(item.task.nextDueAt);
    addStats(
      total,
      await deliver({
        userId: item.memberUserId,
        email: item.email,
        homeId: item.task.homeId,
        entityType: "MAINTENANCE_TASK",
        entityId: item.task.id,
        reminderType: "MAINTENANCE_DUE_SOON",
        scheduledFor: reminderSchedule(
          preference,
          "MAINTENANCE",
          item.task.nextDueAt,
        ),
        preference,
        title: item.task.title,
        message: `Maintenance due ${formattedDue}.`,
        actionUrl: "/maintenance",
      }),
    );
  }

  const warrantyCandidates = await db
    .select({
      asset: assets,
      memberUserId: homeMembers.userId,
      email: user.email,
      emailEnabled: notificationPreferences.emailEnabled,
      inAppEnabled: notificationPreferences.inAppEnabled,
      maintenanceReminderDays:
        notificationPreferences.maintenanceReminderDays,
      warrantyReminderDays: notificationPreferences.warrantyReminderDays,
      documentExpiryReminderDays:
        notificationPreferences.documentExpiryReminderDays,
      timezone: notificationPreferences.timezone,
    })
    .from(assets)
    .innerJoin(homeMembers, eq(homeMembers.homeId, assets.homeId))
    .innerJoin(user, eq(user.id, homeMembers.userId))
    .leftJoin(
      notificationPreferences,
      eq(notificationPreferences.userId, homeMembers.userId),
    )
    .where(
      and(
        isNull(assets.archivedAt),
        gte(assets.warrantyEndDate, lowerDate),
        lte(assets.warrantyEndDate, upperDate),
      ),
    )
    .limit(batchSize);

  for (const item of warrantyCandidates) {
    if (!item.asset.warrantyEndDate) continue;
    const preference = preferenceFrom(item);
    const dueAt = databaseDate(item.asset.warrantyEndDate);
    if (!shouldSendReminder(preference, "WARRANTY", dueAt, now)) {
      total.skipped += 1;
      continue;
    }
    const formattedDue = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: item.timezone ?? "UTC",
    }).format(dueAt);
    addStats(
      total,
      await deliver({
        userId: item.memberUserId,
        email: item.email,
        homeId: item.asset.homeId,
        entityType: "ASSET",
        entityId: item.asset.id,
        reminderType: "WARRANTY_EXPIRING",
        scheduledFor: reminderSchedule(preference, "WARRANTY", dueAt),
        preference,
        title: `${item.asset.name} warranty is expiring`,
        message: `Warranty ends ${formattedDue}.`,
        actionUrl: `/assets/${item.asset.id}`,
      }),
    );
  }

  const documentCandidates = await db
    .select({
      document: documents,
      memberUserId: homeMembers.userId,
      email: user.email,
      emailEnabled: notificationPreferences.emailEnabled,
      inAppEnabled: notificationPreferences.inAppEnabled,
      maintenanceReminderDays:
        notificationPreferences.maintenanceReminderDays,
      warrantyReminderDays: notificationPreferences.warrantyReminderDays,
      documentExpiryReminderDays:
        notificationPreferences.documentExpiryReminderDays,
      timezone: notificationPreferences.timezone,
    })
    .from(documents)
    .innerJoin(homeMembers, eq(homeMembers.homeId, documents.homeId))
    .innerJoin(user, eq(user.id, homeMembers.userId))
    .leftJoin(
      notificationPreferences,
      eq(notificationPreferences.userId, homeMembers.userId),
    )
    .where(
      and(
        sql`"documents"."archived_at" is null`,
        gte(documents.expiryDate, lowerDate),
        lte(documents.expiryDate, upperDate),
      ),
    )
    .limit(batchSize);

  for (const item of documentCandidates) {
    if (!item.document.expiryDate) continue;
    const preference = preferenceFrom(item);
    const dueAt = databaseDate(item.document.expiryDate);
    if (!shouldSendReminder(preference, "DOCUMENT_EXPIRY", dueAt, now)) {
      total.skipped += 1;
      continue;
    }
    const formattedDue = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: item.timezone ?? "UTC",
    }).format(dueAt);
    addStats(
      total,
      await deliver({
        userId: item.memberUserId,
        email: item.email,
        homeId: item.document.homeId,
        entityType: "DOCUMENT",
        entityId: item.document.id,
        reminderType: "DOCUMENT_EXPIRING",
        scheduledFor: reminderSchedule(
          preference,
          "DOCUMENT_EXPIRY",
          dueAt,
        ),
        preference,
        title: `${item.document.title} is expiring`,
        message: `Document expires ${formattedDue}.`,
        actionUrl: "/documents",
      }),
    );
  }

  const weeklyCandidates = await db
    .selectDistinct({
      userId: user.id,
      email: user.email,
      emailEnabled: notificationPreferences.emailEnabled,
      inAppEnabled: notificationPreferences.inAppEnabled,
      maintenanceReminderDays:
        notificationPreferences.maintenanceReminderDays,
      warrantyReminderDays: notificationPreferences.warrantyReminderDays,
      documentExpiryReminderDays:
        notificationPreferences.documentExpiryReminderDays,
      weeklySummaryEnabled: notificationPreferences.weeklySummaryEnabled,
    })
    .from(user)
    .innerJoin(homeMembers, eq(homeMembers.userId, user.id))
    .leftJoin(
      notificationPreferences,
      eq(notificationPreferences.userId, user.id),
    )
    .where(eq(user.emailVerified, true))
    .limit(batchSize);

  const nextWeek = new Date(now.getTime() + 7 * dayMs);
  const nextMonthDate = dateOnly(new Date(now.getTime() + 30 * dayMs));
  for (const item of weeklyCandidates) {
    if (item.weeklySummaryEnabled === false) {
      total.skipped += 1;
      continue;
    }
    const memberships = await db
      .select({ homeId: homeMembers.homeId })
      .from(homeMembers)
      .innerJoin(homes, eq(homes.id, homeMembers.homeId))
      .where(and(eq(homeMembers.userId, item.userId), isNull(homes.archivedAt)));
    const homeIds = memberships.map((membership) => membership.homeId);
    if (!homeIds.length) {
      total.skipped += 1;
      continue;
    }

    const [overdue, upcoming, openRepairs, expiringWarranties, expiringDocuments] =
      await Promise.all([
        db
          .select({ id: maintenanceTasks.id })
          .from(maintenanceTasks)
          .where(
            and(
              inArray(maintenanceTasks.homeId, homeIds),
              isNull(maintenanceTasks.archivedAt),
              lte(maintenanceTasks.nextDueAt, now),
            ),
          )
          .limit(100),
        db
          .select({ id: maintenanceTasks.id })
          .from(maintenanceTasks)
          .where(
            and(
              inArray(maintenanceTasks.homeId, homeIds),
              isNull(maintenanceTasks.archivedAt),
              gte(maintenanceTasks.nextDueAt, now),
              lte(maintenanceTasks.nextDueAt, nextWeek),
            ),
          )
          .limit(100),
        db
          .select({ id: repairRecords.id })
          .from(repairRecords)
          .where(
            and(
              inArray(repairRecords.homeId, homeIds),
              sql`"repair_records"."archived_at" is null`,
              notInArray(repairRecords.status, ["COMPLETED", "CANCELLED"]),
            ),
          )
          .limit(100),
        db
          .select({ id: assets.id })
          .from(assets)
          .where(
            and(
              inArray(assets.homeId, homeIds),
              isNull(assets.archivedAt),
              gte(assets.warrantyEndDate, dateOnly(now)),
              lte(assets.warrantyEndDate, nextMonthDate),
            ),
          )
          .limit(100),
        db
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              inArray(documents.homeId, homeIds),
              sql`"documents"."archived_at" is null`,
              gte(documents.expiryDate, dateOnly(now)),
              lte(documents.expiryDate, nextMonthDate),
            ),
          )
          .limit(100),
      ]);

    const preference = preferenceFrom(item);
    const message = [
      `${overdue.length} overdue maintenance task${overdue.length === 1 ? "" : "s"}`,
      `${upcoming.length} due in the next 7 days`,
      `${openRepairs.length} open repair${openRepairs.length === 1 ? "" : "s"}`,
      `${expiringWarranties.length} warrant${expiringWarranties.length === 1 ? "y" : "ies"} expiring within 30 days`,
      `${expiringDocuments.length} document${expiringDocuments.length === 1 ? "" : "s"} expiring within 30 days`,
    ].join(" · ");

    addStats(
      total,
      await deliver({
        userId: item.userId,
        email: item.email,
        entityType: "USER",
        entityId: item.userId,
        reminderType: "WEEKLY_SUMMARY",
        scheduledFor: utcWeekStart(now),
        preference,
        title: "Your weekly Homi summary",
        message,
        actionUrl: "/dashboard",
      }),
    );
  }

  return {
    candidates:
      maintenanceCandidates.length +
      warrantyCandidates.length +
      documentCandidates.length +
      weeklyCandidates.length,
    breakdown: {
      maintenance: maintenanceCandidates.length,
      warranties: warrantyCandidates.length,
      documents: documentCandidates.length,
      weeklySummaries: weeklyCandidates.length,
    },
    ...total,
  };
}
