import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assetIdentifiers } from "@/db/connected-platform-schema";
import { assets } from "@/db/schema";
import { requireHomeAccess, requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { enqueueWebhookEvent } from "@/src/server/integrations/webhooks";

const input = z.object({
  homeId: z.string().uuid(),
  assetId: z.string().uuid(),
  barcode: z.string().trim().min(3).max(160),
  format: z.string().trim().max(40).optional(),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const url = new URL(request.url);
    const homeId = z.string().uuid().parse(url.searchParams.get("homeId"));
    const barcode = z.string().trim().min(3).max(160).parse(url.searchParams.get("code"));
    await requireHomeAccess(homeId);
    const [row] = await db
      .select({ asset: assets, identifier: assetIdentifiers })
      .from(assetIdentifiers)
      .innerJoin(assets, eq(assets.id, assetIdentifiers.assetId))
      .where(
        and(
          eq(assetIdentifiers.barcode, barcode),
          eq(assets.homeId, homeId),
          isNull(assets.archivedAt),
        ),
      )
      .limit(1);
    return Response.json({ result: row ?? null, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = input.parse(await request.json());
    const { session } = await requireHomeRole(body.homeId, ["OWNER", "ADMIN"]);
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
    const [identifier] = await db
      .insert(assetIdentifiers)
      .values({
        assetId: body.assetId,
        barcode: body.barcode,
        format: body.format,
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: assetIdentifiers.assetId,
        set: {
          barcode: body.barcode,
          format: body.format,
          updatedBy: session.user.id,
          updatedAt: new Date(),
        },
      })
      .returning();
    await enqueueWebhookEvent(body.homeId, "asset.updated", {
      assetId: body.assetId,
      barcode: body.barcode,
      source: "scanner",
    });
    return Response.json({ identifier, requestId: id });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("asset_identifiers_barcode_unique")
    )
      return errorResponse(
        new AppError("CONFLICT", "This barcode is already assigned.", 409),
        id,
      );
    return errorResponse(error, id);
  }
}
