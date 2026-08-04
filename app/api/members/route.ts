import { eq } from "drizzle-orm";
import { db } from "@/db";
import { homeMembers, user } from "@/db/schema";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { profileAvatarUrl } from "@/src/server/profile/avatar";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId)
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "homeId is required" } },
        { status: 400 },
      );
    const { session, member: currentMembership } =
      await requireHomeAccess(homeId);
    const rows = await db
      .select({
        id: homeMembers.id,
        userId: homeMembers.userId,
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
    return Response.json({
      members: rows.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        name: member.name,
        email: member.email,
        avatarUrl: profileAvatarUrl(member.userId, member.image),
      })),
      currentUserId: session.user.id,
      currentRole: currentMembership.role,
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
