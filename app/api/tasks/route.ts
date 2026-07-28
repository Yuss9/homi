import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { maintenanceTasks } from "@/db/schema";
import { requireHomeAccess } from "@/src/server/authorization";
import { requireHomeRole } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { createMaintenanceTask, taskInput } from "@/src/server/services/maintenance";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId)
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "homeId is required" } },
        { status: 400 },
      );
    await requireHomeAccess(homeId);
    const tasks = await db
      .select()
      .from(maintenanceTasks)
      .where(and(eq(maintenanceTasks.homeId, homeId), isNull(maintenanceTasks.archivedAt)))
      .orderBy(asc(maintenanceTasks.nextDueAt));
    return Response.json({ tasks, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = taskInput.parse(await request.json());
    const { session } = await requireHomeRole(body.homeId, ["OWNER", "ADMIN"]);
    return Response.json(
      { task: await createMaintenanceTask(session.user.id, body), requestId: id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
