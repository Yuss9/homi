import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { homeMembers, notifications } from "@/db/schema";
import { canManageMembers } from "@/src/server/authorization";
import { membershipChangeReason } from "@/src/features/members/management";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

const roleInput = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

async function getTarget(memberId: string) {
  const [target] = await db
    .select({
      id: homeMembers.id,
      homeId: homeMembers.homeId,
      userId: homeMembers.userId,
      role: homeMembers.role,
    })
    .from(homeMembers)
    .where(eq(homeMembers.id, memberId))
    .limit(1);
  if (!target) throw new AppError("NOT_FOUND", "Member not found.", 404);
  return target;
}

function assertCanChange(
  actor: { userId: string; role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" },
  target: Awaited<ReturnType<typeof getTarget>>,
  desiredRole?: "ADMIN" | "MEMBER" | "VIEWER",
) {
  const reason = membershipChangeReason(actor, target, desiredRole);
  if (reason) throw new AppError("FORBIDDEN", reason, 403);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const id = requestId(request);
  try {
    const { memberId } = await context.params;
    const target = await getTarget(memberId);
    const { session, member } = await canManageMembers(target.homeId);
    const body = roleInput.parse(await request.json());
    assertCanChange(
      { userId: session.user.id, role: member.role },
      target,
      body.role,
    );
    const [updated] = await db
      .update(homeMembers)
      .set({ role: body.role, updatedAt: new Date() })
      .where(eq(homeMembers.id, target.id))
      .returning({ id: homeMembers.id, role: homeMembers.role });
    await db.insert(notifications).values({
      userId: target.userId,
      homeId: target.homeId,
      type: "HOUSEHOLD_ROLE_CHANGED",
      title: "Household access updated",
      message: `Your household role is now ${body.role.toLowerCase()}.`,
      actionUrl: "/members",
    });
    return Response.json({ member: updated, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const id = requestId(request);
  try {
    const { memberId } = await context.params;
    const target = await getTarget(memberId);
    const { session, member } = await canManageMembers(target.homeId);
    assertCanChange(
      { userId: session.user.id, role: member.role },
      target,
    );
    await db.delete(homeMembers).where(eq(homeMembers.id, target.id));
    await db.insert(notifications).values({
      userId: target.userId,
      type: "HOUSEHOLD_ACCESS_REMOVED",
      title: "Household access removed",
      message: "Your access to a shared home was removed.",
      actionUrl: "/dashboard",
    });
    return Response.json({ removed: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
