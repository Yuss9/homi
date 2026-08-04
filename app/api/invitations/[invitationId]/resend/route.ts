import { addDays } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { homeInvitations, homes } from "@/db/schema";
import { canManageMembers } from "@/src/server/authorization";
import { invitationEmail } from "@/src/server/email/templates";
import { sendEmail } from "@/src/server/email";
import { getEnv } from "@/src/server/env";
import { AppError } from "@/src/server/errors";
import { createInvitationToken } from "@/src/features/members/invitation-token";
import { errorResponse, requestId } from "@/src/server/http";
import { enforceRateLimit } from "@/src/server/rate-limit";

export async function POST(
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
        email: homeInvitations.email,
        role: homeInvitations.role,
        tokenHash: homeInvitations.tokenHash,
        expiresAt: homeInvitations.expiresAt,
        acceptedAt: homeInvitations.acceptedAt,
        revokedAt: homeInvitations.revokedAt,
        homeName: homes.name,
      })
      .from(homeInvitations)
      .innerJoin(homes, eq(homes.id, homeInvitations.homeId))
      .where(eq(homeInvitations.id, invitationId))
      .limit(1);
    if (!invitation)
      throw new AppError("NOT_FOUND", "Invitation not found.", 404);
    const { session, member } = await canManageMembers(invitation.homeId);
    if (member.role === "ADMIN" && invitation.role === "ADMIN")
      throw new AppError(
        "FORBIDDEN",
        "Only the owner can resend an admin invitation.",
        403,
      );
    if (invitation.acceptedAt || invitation.revokedAt)
      throw new AppError(
        "CONFLICT",
        "This invitation is no longer pending.",
        409,
      );
    await enforceRateLimit("invitation-resend", session.user.id, {
      limit: 20,
      windowSeconds: 3600,
    });

    const { token, hash } = createInvitationToken();
    const expiresAt = addDays(new Date(), 7);
    await db
      .update(homeInvitations)
      .set({ tokenHash: hash, expiresAt, createdAt: new Date() })
      .where(eq(homeInvitations.id, invitation.id));

    const inviteUrl = `${getEnv().NEXT_PUBLIC_APP_URL}/invite/${token}`;
    try {
      await sendEmail(
        invitation.email,
        invitationEmail(session.user.name, invitation.homeName, inviteUrl),
      );
    } catch (error) {
      await db
        .update(homeInvitations)
        .set({
          tokenHash: invitation.tokenHash,
          expiresAt: invitation.expiresAt,
        })
        .where(eq(homeInvitations.id, invitation.id));
      throw error;
    }

    return Response.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt,
      },
      inviteUrl,
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
