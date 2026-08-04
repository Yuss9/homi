import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceRecords } from "@/db/schema";
import { requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

const input = z.object({
  notes: z.string().trim().max(4000).optional().nullable(),
  cost: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/)
    .optional()
    .nullable(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  serviceProvider: z.string().trim().max(160).optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const id = requestId(request);
  try {
    const { recordId } = await context.params;
    const [record] = await db
      .select({ id: maintenanceRecords.id, homeId: maintenanceRecords.homeId })
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.id, recordId))
      .limit(1);
    if (!record)
      throw new AppError("NOT_FOUND", "Maintenance record not found.", 404);
    await requireHomeRole(record.homeId, ["OWNER", "ADMIN"]);
    const body = input.parse(await request.json());
    const [updated] = await db
      .update(maintenanceRecords)
      .set({
        notes: body.notes || null,
        cost: body.cost || null,
        currency: body.currency,
        serviceProvider: body.serviceProvider || null,
      })
      .where(eq(maintenanceRecords.id, record.id))
      .returning();
    return Response.json({ record: updated, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
