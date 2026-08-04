import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceTemplates } from "@/db/high-value-schema";
import { requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

const updateInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable(),
    category: z.string().trim().min(1).max(80),
    frequencyType: z.enum([
      "ONCE",
      "DAILY",
      "WEEKLY",
      "MONTHLY",
      "YEARLY",
      "CUSTOM",
    ]),
    frequencyInterval: z.number().int().min(1).max(3650),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    estimatedDurationMinutes: z.number().int().min(1).max(1440).nullable(),
  })
  .partial();

async function getTemplate(templateId: string) {
  const [template] = await db
    .select()
    .from(maintenanceTemplates)
    .where(
      and(
        eq(maintenanceTemplates.id, templateId),
        isNull(maintenanceTemplates.archivedAt),
      ),
    )
    .limit(1);
  if (!template)
    throw new AppError("NOT_FOUND", "Maintenance template not found.", 404);
  return template;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const id = requestId(request);
  try {
    const { templateId } = await context.params;
    const template = await getTemplate(templateId);
    await requireHomeRole(template.homeId, ["OWNER", "ADMIN"]);
    const body = updateInput.parse(await request.json());
    const [updated] = await db
      .update(maintenanceTemplates)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(maintenanceTemplates.id, template.id))
      .returning();
    return Response.json({ template: { ...updated, source: "HOME" }, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const id = requestId(request);
  try {
    const { templateId } = await context.params;
    const template = await getTemplate(templateId);
    await requireHomeRole(template.homeId, ["OWNER", "ADMIN"]);
    await db
      .update(maintenanceTemplates)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(maintenanceTemplates.id, template.id));
    return Response.json({ archived: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
