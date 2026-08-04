import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  maintenanceRecords,
  maintenanceTasks,
  user,
} from "@/db/schema";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "homeId is required" } },
        { status: 400 },
      );
    }
    const { member } = await requireHomeAccess(homeId);
    const records = await db
      .select({
        id: maintenanceRecords.id,
        completedAt: maintenanceRecords.completedAt,
        notes: maintenanceRecords.notes,
        cost: maintenanceRecords.cost,
        currency: maintenanceRecords.currency,
        serviceProvider: maintenanceRecords.serviceProvider,
        taskTitle: maintenanceTasks.title,
        assetName: assets.name,
        completedByName: user.name,
      })
      .from(maintenanceRecords)
      .leftJoin(
        maintenanceTasks,
        eq(maintenanceTasks.id, maintenanceRecords.taskId),
      )
      .leftJoin(assets, eq(assets.id, maintenanceRecords.assetId))
      .innerJoin(user, eq(user.id, maintenanceRecords.completedBy))
      .where(eq(maintenanceRecords.homeId, homeId))
      .orderBy(desc(maintenanceRecords.completedAt))
      .limit(200);
    return Response.json({
      records,
      canManage: member.role === "OWNER" || member.role === "ADMIN",
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
