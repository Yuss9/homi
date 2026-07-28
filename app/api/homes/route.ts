import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { createHome, listHomes } from "@/src/server/services/homes";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    return Response.json({ homes: await listHomes(session.user.id), requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const home = await createHome(session.user.id, await request.json());
    return Response.json({ home, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}

