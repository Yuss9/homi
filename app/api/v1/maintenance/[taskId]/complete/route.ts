import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceTasks } from "@/db/schema";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import {
  authenticateApiKey,
  requireApiHomeAccess,
} from "@/src/server/integrations/tokens";
import { enqueueWebhookEvent } from "@/src/server/integrations/webhooks";
import { completeMaintenanceTask } from "@/src/server/services/maintenance";

const input = z.object({
  idempotencyKey: z.string().uuid().default(() => randomUUID()),
  completedAt: z.coerce.date().default(() => new Date()),
  notes: z.string().trim().max(4000).optional(),
  cost: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).optional(),
  currency: z.string().trim().length(3).default("EUR"),
  serviceProvider: z.string().trim().max(160).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const id = requestId(request);
  try {
    const auth = await authenticateApiKey(request, "maintenance:write");
    const taskId = z.string().uuid().parse((await params).taskId);
    const [task] = await db
      .select({ homeId: maintenanceTasks.homeId, title: maintenanceTasks.title })
      .from(maintenanceTasks)
      .where(eq(maintenanceTasks.id, taskId))
      .limit(1);
    if (!task) throw new AppError("NOT_FOUND", "Maintenance task not found.", 404);
    await requireApiHomeAccess(auth.userId, task.homeId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    const body = input.parse(await request.json());
    const result = await completeMaintenanceTask(auth.userId, {
      ...body,
      currency: body.currency.toUpperCase(),
      taskId,
    });
    await enqueueWebhookEvent(task.homeId, "maintenance.completed", {
      taskId,
      title: task.title,
      recordId: result.record?.id,
      completedAt: body.completedAt.toISOString(),
      source: "api",
    });
    return Response.json({ ...result, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
