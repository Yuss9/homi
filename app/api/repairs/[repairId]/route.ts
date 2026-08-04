import { errorResponse, requestId } from "@/src/server/http";
import {
  archiveRepair,
  getRepair,
  updateRepair,
} from "@/src/server/services/resource-lifecycle";

type Context = { params: Promise<{ repairId: string }> };

export async function GET(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { repairId } = await params;
    return Response.json({ repair: await getRepair(repairId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { repairId } = await params;
    return Response.json({
      repair: await updateRepair(repairId, await request.json()),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { repairId } = await params;
    return Response.json({ repair: await archiveRepair(repairId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
