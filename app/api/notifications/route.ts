import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("READ"), notificationId: z.string().uuid() }),
  z.object({ action: z.literal("DISMISS"), notificationId: z.string().uuid() }),
  z.object({ action: z.literal("READ_ALL") }),
]);

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, session.user.id),
          isNull(notifications.dismissedAt),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(100);
    return Response.json({ notifications: rows, requestId: id });
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
      await db
        .update(notifications)
        .set(
          input.action === "READ"
            ? { readAt: new Date() }
            : { dismissedAt: new Date() },
        )
        .where(
          and(
            eq(notifications.id, input.notificationId),
            eq(notifications.userId, session.user.id),
          ),
        );
    }
    return Response.json({ ok: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
