import { getEnv } from "@/src/server/env";
import { errorResponse, requestId } from "@/src/server/http";
import { processNotificationPush } from "@/src/server/jobs/notification-push";
import { processReminders } from "@/src/server/jobs/reminders";

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
    return Response.json({ result: { reminders, push }, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
