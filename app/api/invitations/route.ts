import { addDays } from "date-fns";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { homeInvitations, homeMembers, homes, user } from "@/db/schema";
import { canManageMembers } from "@/src/server/authorization";
import { createInvitationToken } from "@/src/features/members/invitation-token";
import { sendEmail } from "@/src/server/email";
import { invitationEmail } from "@/src/server/email/templates";
import { getEnv } from "@/src/server/env";
import { errorResponse, requestId } from "@/src/server/http";
import { logger } from "@/src/server/logger";
import { enforceRateLimit } from "@/src/server/rate-limit";

const emailSchema = z.string().trim().toLowerCase().email();
const input = z
  .object({
    homeId: z.string().uuid(),
    email: emailSchema.optional(),
    emails: z.array(emailSchema).min(1).max(20).optional(),
    role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
  })
  .refine((value) => Boolean(value.email || value.emails?.length), {
    message: "At least one email address is required.",
    path: ["emails"],
  });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId)
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "homeId is required" } },
        { status: 400 },
      );
    await canManageMembers(homeId);
    const invitations = await db
      .select({
        id: homeInvitations.id,
        email: homeInvitations.email,
        role: homeInvitations.role,
        expiresAt: homeInvitations.expiresAt,
        createdAt: homeInvitations.createdAt,
      })
      .from(homeInvitations)
      .where(
        and(
          eq(homeInvitations.homeId, homeId),
          isNull(homeInvitations.acceptedAt),
          isNull(homeInvitations.revokedAt),
          gt(homeInvitations.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(homeInvitations.createdAt));
    return Response.json({ invitations, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = input.parse(await request.json());
    const { session, member } = await canManageMembers(body.homeId);
    if (member.role === "ADMIN" && body.role === "ADMIN")
      return Response.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only the owner can invite another admin.",
          },
        },
        { status: 403 },
      );
    await enforceRateLimit("invitation", session.user.id, {
      limit: 30,
      windowSeconds: 3600,
    });

    const emails = [
      ...new Set([...(body.emails ?? []), ...(body.email ? [body.email] : [])]),
    ];
    const [home, existingMembers] = await Promise.all([
      db
        .select({ name: homes.name })
        .from(homes)
        .where(eq(homes.id, body.homeId))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({ email: user.email })
        .from(homeMembers)
        .innerJoin(user, eq(user.id, homeMembers.userId))
        .where(eq(homeMembers.homeId, body.homeId)),
    ]);
    const memberEmails = new Set(
      existingMembers.map((entry) => entry.email.toLowerCase()),
    );
    const skipped: { email: string; reason: string }[] = [];
    const invitations: {
      id: string;
      email: string;
      role: string;
      expiresAt: Date;
    }[] = [];
    const failed: { email: string; reason: string }[] = [];

    for (const email of emails) {
      if (memberEmails.has(email)) {
        skipped.push({ email, reason: "Already a household member" });
        continue;
      }
      if (email === session.user.email.toLowerCase()) {
        skipped.push({ email, reason: "You already have access" });
        continue;
      }

      const { token, hash } = createInvitationToken();
      const expiresAt = addDays(new Date(), 7);
      const invitation = await db.transaction(async (tx) => {
        await tx
          .update(homeInvitations)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(homeInvitations.homeId, body.homeId),
              eq(homeInvitations.email, email),
              isNull(homeInvitations.acceptedAt),
              isNull(homeInvitations.revokedAt),
            ),
          );
        const [created] = await tx
          .insert(homeInvitations)
          .values({
            homeId: body.homeId,
            email,
            role: body.role,
            tokenHash: hash,
            invitedBy: session.user.id,
            expiresAt,
          })
          .returning({
            id: homeInvitations.id,
            email: homeInvitations.email,
            role: homeInvitations.role,
            expiresAt: homeInvitations.expiresAt,
          });
        return created;
      });
      if (!invitation) continue;

      try {
        await sendEmail(
          email,
          invitationEmail(
            session.user.name,
            home?.name ?? "a home",
            `${getEnv().NEXT_PUBLIC_APP_URL}/invite/${token}`,
          ),
        );
        invitations.push(invitation);
      } catch (error) {
        await db
          .update(homeInvitations)
          .set({ revokedAt: new Date() })
          .where(eq(homeInvitations.id, invitation.id));
        failed.push({ email, reason: "Email delivery failed" });
        logger.error(
          { invitationId: invitation.id, email, error },
          "invitation_delivery_failed",
        );
      }
    }

    return Response.json(
      { invitations, skipped, failed, requestId: id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
