import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceTemplates } from "@/db/high-value-schema";
import { findSystemMaintenanceTemplate } from "@/src/features/maintenance/templates";
import { requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { createMaintenanceTask } from "@/src/server/services/maintenance";

const input = z.object({
  homeId: z.string().uuid(),
  assetId: z.string().uuid().optional().nullable(),
  nextDueAt: z.coerce.date(),
  assignedTo: z.string().uuid().optional().nullable(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const id = requestId(request);
  try {
    const { templateId } = await context.params;
    const body = input.parse(await request.json());
    const { session } = await requireHomeRole(body.homeId, ["OWNER", "ADMIN"]);

    const system = findSystemMaintenanceTemplate(templateId);
    const custom = system
      ? null
      : await db
          .select()
          .from(maintenanceTemplates)
          .where(
            and(
              eq(maintenanceTemplates.id, templateId),
              eq(maintenanceTemplates.homeId, body.homeId),
              isNull(maintenanceTemplates.archivedAt),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
    const template = system ?? custom;
    if (!template)
      throw new AppError("NOT_FOUND", "Maintenance template not found.", 404);

    const task = await createMaintenanceTask(session.user.id, {
      homeId: body.homeId,
      assetId: body.assetId ?? null,
      assignedTo: body.assignedTo ?? null,
      nextDueAt: body.nextDueAt,
      title: template.title,
      description: template.description ?? undefined,
      frequencyType: template.frequencyType,
      frequencyInterval: template.frequencyInterval,
      priority: template.priority,
      estimatedDurationMinutes: template.estimatedDurationMinutes ?? undefined,
    });

    return Response.json({ task, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
