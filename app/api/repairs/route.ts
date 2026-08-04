import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { repairRecords } from "@/db/schema";
import {
  requireAssetInHome,
  requireHomeAccess,
  requireHomeRole,
} from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const repairInput = z.object({
  homeId: z.string().uuid(),
  assetId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  issueDate: z.string().date(),
  repairDate: z.string().date().optional(),
  status: z
    .enum(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .default("OPEN"),
  provider: z.string().trim().max(160).optional(),
  cost: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/)
    .optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .default("EUR"),
  warrantyClaim: z.boolean().default(false),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId)
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "homeId is required",
          },
        },
        { status: 400 },
      );
    await requireHomeAccess(homeId);
    const repairs = await db
      .select()
      .from(repairRecords)
      .where(
        and(
          eq(repairRecords.homeId, homeId),
          sql`"repair_records"."archived_at" is null`,
        ),
      )
      .orderBy(desc(repairRecords.createdAt))
      .limit(100);
    return Response.json({ repairs, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = repairInput.parse(await request.json());
    const { session } = await requireHomeRole(input.homeId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    await requireAssetInHome(input.assetId, input.homeId);
    const [repair] = await db
      .insert(repairRecords)
      .values({ ...input, createdBy: session.user.id })
      .returning();
    return Response.json({ repair, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
