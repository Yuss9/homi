import { eq } from "drizzle-orm";
import { db } from "@/db";
import { homeInvitations } from "@/db/schema";
import { canManageMembers } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const id = requestId(request);
  try {
    const { invitationId } = await context.params;
    const [invitation] = await db
      .select({
        id: homeInvitations.id,
        homeId: homeInvitations.homeId,
        role: homeInvitations.role,
        revokedAt: homeInvitations.revokedAt,
        acceptedAt: homeInvitations.acceptedAt,
      })
      .from(homeInvitations)
      .where(eq(homeInvitations.id, invitationId))
      .limit(1);
    if (!invitation)
      throw new AppError("NOT_FOUND", "Invitation not found.", 404);
    const { member } = await canManageMembers(invitation.homeId);
    if (member.role === "ADMIN" && invitation.role === "ADMIN")
      throw new AppError(
        "FORBIDDEN",
        "Only the owner can revoke an admin invitation.",
        403,
      );
    if (invitation.acceptedAt || invitation.revokedAt)
      throw new AppError(
        "VALIDATION_ERROR",
        "This invitation is no longer pending.",
        409,
      );
    await db
      .update(homeInvitations)
      .set({ revokedAt: new Date() })
      .where(eq(homeInvitations.id, invitation.id));
    return Response.json({ revoked: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
