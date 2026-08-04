import { errorResponse, requestId } from "@/src/server/http";
import {
  archiveAsset,
  getAsset,
  updateAsset,
} from "@/src/server/services/resource-lifecycle";

type Context = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { assetId } = await params;
    return Response.json({ asset: await getAsset(assetId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { assetId } = await params;
    return Response.json({
      asset: await updateAsset(assetId, await request.json()),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { assetId } = await params;
    return Response.json({ asset: await archiveAsset(assetId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
