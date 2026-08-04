import "server-only";

import { and, asc, gte, isNull } from "drizzle-orm";
import { db } from "../../../db";
import { notifications } from "../../../db/schema";
import { sendPushToUser } from "../push";

export async function processNotificationPush(
  since: Date,
  batchSize = 200,
) {
  const rows = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      title: notifications.title,
      message: notifications.message,
      actionUrl: notifications.actionUrl,
    })
    .from(notifications)
    .where(
      and(
        gte(notifications.createdAt, since),
        isNull(notifications.dismissedAt),
      ),
    )
    .orderBy(asc(notifications.createdAt))
    .limit(batchSize);

  const result = { notifications: rows.length, delivered: 0, failed: 0, disabled: 0 };
  for (const notification of rows) {
    const delivery = await sendPushToUser(notification.userId, {
      title: notification.title,
      body: notification.message,
      url: notification.actionUrl ?? "/notifications",
      tag: `homi-${notification.id}`,
    });
    result.delivered += delivery.delivered;
    result.failed += delivery.failed;
    result.disabled += delivery.disabled;
  }
  return result;
}
