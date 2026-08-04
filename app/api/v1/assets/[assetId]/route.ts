import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assetIdentifiers } from "@/db/connected-platform-schema";
import { assets } from "@/db/schema";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import {
  authenticateApiKey,
  requireApiHomeAccess,
} from "@/src/server/integrations/tokens";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const id = requestId(request);
  try {
    const auth = await authenticateApiKey(request, "assets:read");
    const assetId = z.string().uuid().parse((await params).assetId);
    const [row] = await db
      .select({ asset: assets, barcode: assetIdentifiers.barcode })
      .from(assets)
      .leftJoin(assetIdentifiers, eq(assetIdentifiers.assetId, assets.id))
      .where(and(eq(assets.id, assetId), isNull(assets.archivedAt)))
      .limit(1);
    if (!row) throw new AppError("NOT_FOUND", "Asset not found.", 404);
    await requireApiHomeAccess(auth.userId, row.asset.homeId);
    return Response.json({
      asset: {
        ...row.asset,
        barcode: row.barcode,
        url: `/assets/${row.asset.id}`,
      },
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
