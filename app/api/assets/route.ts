import { requireHomeAccess, requireHomeRole } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { assetInput, createAsset, listAssets } from "@/src/server/services/assets";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const url = new URL(request.url);
    const homeId = url.searchParams.get("homeId");
    if (!homeId) return Response.json({ error: { code: "VALIDATION_ERROR", message: "homeId is required" } }, { status: 400 });
    await requireHomeAccess(homeId);
    return Response.json({ assets: await listAssets(homeId, url.searchParams.get("q") ?? undefined), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = assetInput.parse(await request.json());
    const { session } = await requireHomeRole(body.homeId, ["OWNER", "ADMIN"]);
    return Response.json({ asset: await createAsset(session.user.id, body), requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}

