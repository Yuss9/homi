import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, homeMembers, homes, notifications } from "@/db/schema";
import { requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

const input = z.object({ memberId: z.string().uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ homeId: string }> },
) {
  const id = requestId(request);
  try {
    const { homeId } = await context.params;
    const body = input.parse(await request.json());
    const { session, member: actor } = await requireHomeRole(homeId, ["OWNER"]);
    const [target] = await db
      .select({
        id: homeMembers.id,
        userId: homeMembers.userId,
        role: homeMembers.role,
      })
      .from(homeMembers)
      .where(
        and(eq(homeMembers.id, body.memberId), eq(homeMembers.homeId, homeId)),
      )
      .limit(1);
    if (!target) throw new AppError("NOT_FOUND", "Member not found.", 404);
    if (target.userId === session.user.id)
      throw new AppError(
        "VALIDATION_ERROR",
        "You already own this home.",
        409,
      );

    await db.transaction(async (tx) => {
      await tx
        .update(homeMembers)
        .set({ role: "ADMIN", updatedAt: new Date() })
        .where(eq(homeMembers.id, actor.id));
      await tx
        .update(homeMembers)
        .set({ role: "OWNER", updatedAt: new Date() })
        .where(eq(homeMembers.id, target.id));
      await tx
        .update(homes)
        .set({ ownerId: target.userId, updatedAt: new Date() })
        .where(eq(homes.id, homeId));
      await tx.insert(notifications).values([
        {
          userId: target.userId,
          homeId,
          type: "HOME_OWNERSHIP_TRANSFERRED",
          title: "You now own this home",
          message: "Ownership and full household administration were transferred to you.",
          actionUrl: "/members",
        },
        {
          userId: session.user.id,
          homeId,
          type: "HOME_OWNERSHIP_TRANSFERRED",
          title: "Home ownership transferred",
          message: "You remain an administrator of this home.",
          actionUrl: "/members",
        },
      ]);
      await tx.insert(auditLogs).values({
        actorId: session.user.id,
        homeId,
        action: "HOME_OWNERSHIP_TRANSFERRED",
        targetType: "HOME_MEMBER",
        targetId: target.id,
        requestId: id,
        metadata: { previousRole: target.role, newOwnerUserId: target.userId },
      });
    });

    return Response.json({ transferred: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
