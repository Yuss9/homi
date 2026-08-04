import { errorResponse, requestId } from "@/src/server/http";
import {
  archiveTask,
  getTask,
  updateTask,
} from "@/src/server/services/resource-lifecycle";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { taskId } = await params;
    return Response.json({ task: await getTask(taskId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { taskId } = await params;
    return Response.json({
      task: await updateTask(taskId, await request.json()),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { taskId } = await params;
    return Response.json({ task: await archiveTask(taskId), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
