import { eq } from "drizzle-orm";
import { db } from "@/db";
import { maintenanceTasks } from "@/db/schema";
import { requireHomeRole } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { completeMaintenanceTask } from "@/src/server/services/maintenance";
import { AppError } from "@/src/server/errors";

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const id = requestId(request);
  try {
    const { taskId } = await context.params;
    const [task] = await db.select({ homeId: maintenanceTasks.homeId }).from(maintenanceTasks).where(eq(maintenanceTasks.id, taskId)).limit(1);
    if (!task) throw new AppError("NOT_FOUND", "Maintenance task not found.", 404);
    const { session } = await requireHomeRole(task.homeId, ["OWNER", "ADMIN", "MEMBER"]);
    const result = await completeMaintenanceTask(session.user.id, { ...(await request.json()), taskId });
    return Response.json({ ...result, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

