import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { assets, homeMembers } from "@/db/schema";
import { createQrSvg } from "@/src/features/assets/qr";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { getEnv } from "@/src/server/env";
import { errorResponse, requestId } from "@/src/server/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const { assetId } = await context.params;
    const [asset] = await db
      .select({ id: assets.id, name: assets.name })
      .from(assets)
      .innerJoin(homeMembers, eq(homeMembers.homeId, assets.homeId))
      .where(
        and(
          eq(assets.id, assetId),
          eq(homeMembers.userId, session.user.id),
          isNull(assets.archivedAt),
        ),
      )
      .limit(1);
    if (!asset) throw new AppError("NOT_FOUND", "Asset not found.", 404);

    const destination = `${getEnv().NEXT_PUBLIC_APP_URL}/assets/${asset.id}`;
    const svg = createQrSvg(destination, `${asset.name} QR code`);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, max-age=300",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="homi-${asset.id}.svg"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
