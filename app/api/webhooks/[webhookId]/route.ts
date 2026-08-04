import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { webhooks } from "@/db/connected-platform-schema";
import { requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const id = requestId(request);
  try {
    const webhookId = z.string().uuid().parse((await params).webhookId);
    const [webhook] = await db
      .select({ id: webhooks.id, homeId: webhooks.homeId })
      .from(webhooks)
      .where(and(eq(webhooks.id, webhookId), isNull(webhooks.disabledAt)))
      .limit(1);
    if (!webhook) throw new AppError("NOT_FOUND", "Webhook not found.", 404);
    await requireHomeRole(webhook.homeId, ["OWNER", "ADMIN"]);
    await db
      .update(webhooks)
      .set({ enabled: false, disabledAt: new Date(), updatedAt: new Date() })
      .where(eq(webhooks.id, webhook.id));
    return Response.json({ ok: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
