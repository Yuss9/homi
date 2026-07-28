import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { homeInvitations, homeMembers, notifications } from "@/db/schema";
import { hashInvitationToken } from "@/src/features/members/invitation-token";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
const input = z.object({ token: z.string().min(32).max(256) });
export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const { token } = input.parse(await request.json());
    const [invitation] = await db.select().from(homeInvitations).where(and(eq(homeInvitations.tokenHash, hashInvitationToken(token)), gt(homeInvitations.expiresAt, new Date()), isNull(homeInvitations.acceptedAt), isNull(homeInvitations.revokedAt))).limit(1);
    if (!invitation || invitation.email !== session.user.email.toLowerCase()) throw new AppError("NOT_FOUND", "This invitation is invalid or has expired.", 404);
    await db.transaction(async (tx) => {
      await tx.insert(homeMembers).values({ homeId: invitation.homeId, userId: session.user.id, role: invitation.role, invitedBy: invitation.invitedBy }).onConflictDoNothing();
      await tx.update(homeInvitations).set({ acceptedAt: new Date() }).where(eq(homeInvitations.id, invitation.id));
      await tx.insert(notifications).values({ userId: invitation.invitedBy, homeId: invitation.homeId, type: "INVITATION_ACCEPTED", title: "Invitation accepted", message: `${session.user.name} joined the household.`, actionUrl: "/members" });
    });
    return Response.json({ homeId: invitation.homeId, requestId: id });
  } catch (error) { return errorResponse(error, id); }
}

