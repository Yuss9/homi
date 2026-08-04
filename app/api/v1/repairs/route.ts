import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assets, repairRecords } from "@/db/schema";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import {
  authenticateApiKey,
  requireApiHomeAccess,
} from "@/src/server/integrations/tokens";
import { enqueueWebhookEvent } from "@/src/server/integrations/webhooks";

const input = z.object({
  homeId: z.string().uuid(),
  assetId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  issueDate: z.string().date().default(() => new Date().toISOString().slice(0, 10)),
  status: z
    .enum(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .default("OPEN"),
  provider: z.string().trim().max(160).optional(),
  cost: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).optional(),
  currency: z.string().trim().length(3).default("EUR"),
  warrantyClaim: z.boolean().default(false),
});

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const auth = await authenticateApiKey(request, "repairs:write");
    const body = input.parse(await request.json());
    await requireApiHomeAccess(auth.userId, body.homeId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
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
    const [repair] = await db
      .insert(repairRecords)
      .values({
        ...body,
        currency: body.currency.toUpperCase(),
        createdBy: auth.userId,
      })
      .returning();
    if (repair)
      await enqueueWebhookEvent(body.homeId, "repair.created", {
        repairId: repair.id,
        assetId: repair.assetId,
        title: repair.title,
        status: repair.status,
        source: "api",
      });
    return Response.json({ repair, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
