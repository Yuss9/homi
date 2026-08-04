import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceTemplates } from "@/db/high-value-schema";
import { systemMaintenanceTemplates } from "@/src/features/maintenance/templates";
import { requireHomeAccess, requireHomeRole } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const templateInput = z.object({
  homeId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1).max(80),
  frequencyType: z.enum([
    "ONCE",
    "DAILY",
    "WEEKLY",
    "MONTHLY",
    "YEARLY",
    "CUSTOM",
  ]),
  frequencyInterval: z.number().int().min(1).max(3650).default(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).optional().nullable(),
});

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
    await requireHomeAccess(homeId);
    const custom = await db
      .select()
      .from(maintenanceTemplates)
      .where(
        and(
          eq(maintenanceTemplates.homeId, homeId),
          isNull(maintenanceTemplates.archivedAt),
        ),
      )
      .orderBy(asc(maintenanceTemplates.category), asc(maintenanceTemplates.title));

    return Response.json({
      templates: [
        ...systemMaintenanceTemplates,
        ...custom.map((template) => ({
          ...template,
          source: "HOME" as const,
        })),
      ],
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = templateInput.parse(await request.json());
    const { session } = await requireHomeRole(body.homeId, ["OWNER", "ADMIN"]);
    const [template] = await db
      .insert(maintenanceTemplates)
      .values({
        ...body,
        description: body.description || null,
        estimatedDurationMinutes: body.estimatedDurationMinutes ?? null,
        createdBy: session.user.id,
      })
      .returning();
    return Response.json(
      { template: { ...template, source: "HOME" as const }, requestId: id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
