import { errorResponse, requestId } from "@/src/server/http";
import {
  archiveDocument,
  getDocument,
  updateDocument,
} from "@/src/server/services/resource-lifecycle";

type Context = { params: Promise<{ documentId: string }> };

export async function GET(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { documentId } = await params;
    return Response.json({
      document: await getDocument(documentId),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { documentId } = await params;
    return Response.json({
      document: await updateDocument(documentId, await request.json()),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const id = requestId(request);
  try {
    const { documentId } = await params;
    return Response.json({
      document: await archiveDocument(documentId),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
