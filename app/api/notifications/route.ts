import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notificationSnoozes } from "@/db/connected-platform-schema";
import { notifications } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("READ"), notificationId: z.string().uuid() }),
  z.object({ action: z.literal("DISMISS"), notificationId: z.string().uuid() }),
  z.object({ action: z.literal("READ_ALL") }),
  z.object({
    action: z.literal("SNOOZE"),
    notificationId: z.string().uuid(),
    until: z.coerce.date(),
  }),
  z.object({ action: z.literal("UNSNOOZE"), notificationId: z.string().uuid() }),
]);

const queryInput = z.object({
  q: z.string().trim().max(80).optional(),
  type: z.string().trim().max(80).optional(),
  state: z.enum(["ACTIVE", "UNREAD", "READ", "SNOOZED", "ALL"]).default("ACTIVE"),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const url = new URL(request.url);
    const input = queryInput.parse({
      q: url.searchParams.get("q") || undefined,
      type: url.searchParams.get("type") || undefined,
      state: url.searchParams.get("state") || undefined,
    });
    const pattern = input.q ? `%${input.q.replaceAll("%", "\\%")} %`.replace(" %", "%") : undefined;
    const rows = await db
      .select({
        notification: notifications,
        snoozedUntil: notificationSnoozes.snoozedUntil,
      })
      .from(notifications)
      .leftJoin(
        notificationSnoozes,
        eq(notificationSnoozes.notificationId, notifications.id),
      )
      .where(
        and(
          eq(notifications.userId, session.user.id),
          isNull(notifications.dismissedAt),
          input.type ? eq(notifications.type, input.type) : undefined,
          pattern
            ? or(
                ilike(notifications.title, pattern),
                ilike(notifications.message, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(200);

    const now = new Date();
    const enriched = rows.map((row) => ({
      ...row.notification,
      snoozedUntil: row.snoozedUntil,
      isSnoozed: Boolean(row.snoozedUntil && row.snoozedUntil > now),
    }));
    const filtered = enriched.filter((notice) => {
      if (input.state === "ALL") return true;
      if (input.state === "SNOOZED") return notice.isSnoozed;
      if (notice.isSnoozed) return false;
      if (input.state === "UNREAD") return !notice.readAt;
      if (input.state === "READ") return Boolean(notice.readAt);
      return true;
    });
    const types = [...new Set(enriched.map((notice) => notice.type))].sort();
    return Response.json({ notifications: filtered, types, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const input = mutation.parse(await request.json());
    if (input.action === "READ_ALL") {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, session.user.id),
            isNull(notifications.readAt),
          ),
        );
    } else {
      const [notice] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.id, input.notificationId),
            eq(notifications.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!notice)
        throw new AppError("NOT_FOUND", "Notification not found.", 404);

      if (input.action === "SNOOZE") {
        const maxUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
        if (input.until.getTime() <= Date.now() || input.until.getTime() > maxUntil)
          throw new AppError(
            "VALIDATION_ERROR",
            "Choose a snooze time within the next 30 days.",
            400,
          );
        await db
          .insert(notificationSnoozes)
          .values({
            notificationId: input.notificationId,
            userId: session.user.id,
            snoozedUntil: input.until,
          })
          .onConflictDoUpdate({
            target: notificationSnoozes.notificationId,
            set: { snoozedUntil: input.until },
          });
      } else if (input.action === "UNSNOOZE") {
        await db
          .delete(notificationSnoozes)
          .where(eq(notificationSnoozes.notificationId, input.notificationId));
      } else {
        await db
          .update(notifications)
          .set(
            input.action === "READ"
              ? { readAt: new Date() }
              : { dismissedAt: new Date() },
          )
          .where(eq(notifications.id, input.notificationId));
        await db
          .delete(notificationSnoozes)
          .where(eq(notificationSnoozes.notificationId, input.notificationId));
      }
    }
    return Response.json({ ok: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
