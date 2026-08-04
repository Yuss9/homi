import { errorResponse, requestId } from "@/src/server/http";
import {
  archiveRoom,
  getRoom,
  updateRoom,
} from "@/src/server/services/resource-lifecycle";

type Context = { params: Promise<{ roomId: string }> };

export async function GET(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { roomId } = await params;
    return Response.json({ room: await getRoom(roomId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { roomId } = await params;
    return Response.json({
      room: await updateRoom(roomId, await request.json()),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { roomId } = await params;
    return Response.json({ room: await archiveRoom(roomId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
