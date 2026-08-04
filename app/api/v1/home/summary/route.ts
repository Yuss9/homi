import { z } from "zod";
import { errorResponse, requestId } from "@/src/server/http";
import { getConnectedHomeSummary } from "@/src/server/integrations/home-summary";
import {
  authenticateApiKey,
  requireApiHomeAccess,
} from "@/src/server/integrations/tokens";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const auth = await authenticateApiKey(request, "home:read");
    const homeId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("homeId"));
    await requireApiHomeAccess(auth.userId, homeId);
    return Response.json({
      summary: await getConnectedHomeSummary(homeId),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
