import { errorResponse, requestId } from "@/src/server/http";
import {
  archiveHome,
  getHome,
  updateHome,
} from "@/src/server/services/resource-lifecycle";

type Context = { params: Promise<{ homeId: string }> };

export async function GET(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { homeId } = await params;
    return Response.json({ home: await getHome(homeId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { homeId } = await params;
    return Response.json({
      home: await updateHome(homeId, await request.json()),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { homeId } = await params;
    return Response.json({ home: await archiveHome(homeId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
