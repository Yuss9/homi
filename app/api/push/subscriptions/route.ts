import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/high-value-schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { pushConfiguration } from "@/src/server/push";

const subscriptionInput = z.object({
  endpoint: z.string().url().max(3000),
  keys: z.object({
    p256dh: z.string().min(40).max(500),
    auth: z.string().min(16).max(200),
  }),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const [row] = await db
      .select({ value: count() })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          isNull(pushSubscriptions.disabledAt),
        ),
      );
    const config = pushConfiguration();
    return Response.json({
      configured: Boolean(config),
      publicKey: config?.publicKey ?? null,
      subscribed: Number(row?.value ?? 0) > 0,
      subscriptionCount: Number(row?.value ?? 0),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const config = pushConfiguration();
    if (!config) {
      return Response.json(
        {
          error: {
            code: "NOT_CONFIGURED",
            message: "Web Push has not been configured by this Homi installation.",
          },
        },
        { status: 503 },
      );
    }
    const body = subscriptionInput.parse(await request.json());
    const [subscription] = await db
      .insert(pushSubscriptions)
      .values({
        userId: session.user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: request.headers.get("user-agent"),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: session.user.id,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent: request.headers.get("user-agent"),
          failureCount: 0,
          disabledAt: null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: pushSubscriptions.id });
    return Response.json({ subscription, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const body = z
      .object({ endpoint: z.string().url().max(3000) })
      .parse(await request.json());
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.endpoint, body.endpoint),
        ),
      );
    return Response.json({ removed: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
