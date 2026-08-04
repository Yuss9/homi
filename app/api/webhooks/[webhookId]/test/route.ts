import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { webhookDeliveries, webhooks } from "@/db/connected-platform-schema";
import { requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { processWebhookDeliveries } from "@/src/server/integrations/webhooks";

export async function POST(
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
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        webhookId: webhook.id,
        event: "asset.updated",
        payload: {
          test: true,
          homeId: webhook.homeId,
          message: "Homi webhook connection test",
        },
      })
      .returning({ id: webhookDeliveries.id });
    if (delivery) await processWebhookDeliveries([delivery.id]);
    const [result] = await db
      .select({
        status: webhookDeliveries.status,
        error: webhookDeliveries.error,
        responseStatus: webhookDeliveries.responseStatus,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, delivery!.id))
      .limit(1);
    return Response.json({ delivery: result, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
