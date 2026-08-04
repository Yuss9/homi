import { z } from "zod";
import { errorResponse, requestId } from "@/src/server/http";
import {
  loadOperations,
  performOperation,
} from "@/src/server/services/operations";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("homeId"));
    return Response.json({
      ...(await loadOperations(homeId)),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    return Response.json({
      ...(await performOperation(await request.json())),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
