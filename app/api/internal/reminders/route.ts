import { getEnv } from "@/src/server/env";
import { errorResponse, requestId } from "@/src/server/http";
import { processReminders } from "@/src/server/jobs/reminders";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${getEnv().CRON_SECRET}`)
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Unauthorized" } }, { status: 401 });
    return Response.json({ result: await processReminders(), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

