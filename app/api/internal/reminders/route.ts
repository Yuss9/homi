import { getEnv } from "@/src/server/env";
import { errorResponse, requestId } from "@/src/server/http";
import { processNotificationPush } from "@/src/server/jobs/notification-push";
import { processReminders } from "@/src/server/jobs/reminders";
import { processWebhookDeliveries } from "@/src/server/integrations/webhooks";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${getEnv().CRON_SECRET}`) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Unauthorized" } },
        { status: 401 },
      );
    }
    const startedAt = new Date();
    const reminders = await processReminders(startedAt);
    const push = await processNotificationPush(startedAt);
    const webhooks = await processWebhookDeliveries();
    return Response.json({
      result: { reminders, push, webhooks },
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
