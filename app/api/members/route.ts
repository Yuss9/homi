import { eq } from "drizzle-orm";
import { db } from "@/db";
import { homeMembers, user } from "@/db/schema";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId)
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "homeId is required" } },
        { status: 400 },
      );
    await requireHomeAccess(homeId);
    const members = await db
      .select({
        id: homeMembers.id,
        role: homeMembers.role,
        joinedAt: homeMembers.joinedAt,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(homeMembers)
      .innerJoin(user, eq(user.id, homeMembers.userId))
      .where(eq(homeMembers.homeId, homeId))
      .orderBy(user.name);
    return Response.json({ members, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
