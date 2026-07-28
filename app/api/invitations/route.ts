import { addDays } from "date-fns";
import { z } from "zod";
import { db } from "@/db";
import { homeInvitations, homes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { canManageMembers } from "@/src/server/authorization";
import { createInvitationToken } from "@/src/features/members/invitation-token";
import { sendEmail } from "@/src/server/email";
import { invitationEmail } from "@/src/server/email/templates";
import { getEnv } from "@/src/server/env";
import { errorResponse, requestId } from "@/src/server/http";
import { enforceRateLimit } from "@/src/server/rate-limit";

const input = z.object({
  homeId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = input.parse(await request.json());
    const { session, member } = await canManageMembers(body.homeId);
    if (member.role === "ADMIN" && body.role === "ADMIN")
      return Response.json({ error: { code: "FORBIDDEN", message: "Only the owner can invite another admin." } }, { status: 403 });
    await enforceRateLimit("invitation", session.user.id, { limit: 10, windowSeconds: 3600 });
    const [home] = await db.select({ name: homes.name }).from(homes).where(eq(homes.id, body.homeId)).limit(1);
    const { token, hash } = createInvitationToken();
    await db
      .update(homeInvitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(homeInvitations.homeId, body.homeId), eq(homeInvitations.email, body.email)));
    const [invitation] = await db.insert(homeInvitations).values({
      homeId: body.homeId,
      email: body.email,
      role: body.role,
      tokenHash: hash,
      invitedBy: session.user.id,
      expiresAt: addDays(new Date(), 7),
    }).returning();
    await sendEmail(body.email, invitationEmail(session.user.name, home?.name ?? "a home", `${getEnv().NEXT_PUBLIC_APP_URL}/invite/${token}`));
    return Response.json({ invitation: { id: invitation?.id, expiresAt: invitation?.expiresAt }, requestId: id }, { status: 201 });
  } catch (error) { return errorResponse(error, id); }
}
