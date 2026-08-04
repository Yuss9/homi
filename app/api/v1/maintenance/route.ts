import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assets, maintenanceTasks } from "@/db/schema";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import {
  authenticateApiKey,
  requireApiHomeAccess,
} from "@/src/server/integrations/tokens";
import { enqueueWebhookEvent } from "@/src/server/integrations/webhooks";

const input = z.object({
  homeId: z.string().uuid(),
  assetId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  frequencyType: z
    .enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"])
    .default("ONCE"),
  frequencyInterval: z.number().int().min(1).max(3650).default(1),
  nextDueAt: z.coerce.date().default(() => new Date()),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).optional(),
});

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const auth = await authenticateApiKey(request, "maintenance:write");
    const body = input.parse(await request.json());
    await requireApiHomeAccess(auth.userId, body.homeId, ["OWNER", "ADMIN"]);
    if (body.assetId) {
      const [asset] = await db
        .select({ id: assets.id })
        .from(assets)
        .where(
          and(
            eq(assets.id, body.assetId),
            eq(assets.homeId, body.homeId),
            isNull(assets.archivedAt),
          ),
        )
        .limit(1);
      if (!asset) throw new AppError("NOT_FOUND", "Asset not found.", 404);
    }
    const [task] = await db
      .insert(maintenanceTasks)
      .values({ ...body, createdBy: auth.userId })
      .returning();
    if (task)
      await enqueueWebhookEvent(body.homeId, "maintenance.created", {
        taskId: task.id,
        title: task.title,
        assetId: task.assetId,
        nextDueAt: task.nextDueAt.toISOString(),
        source: "api",
      });
    return Response.json({ task, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
