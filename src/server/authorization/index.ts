import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "../../../db";
import { homeMembers } from "../../../db/schema";
import { auth } from "../auth";
import { AppError } from "../errors";
import { roles, type HomeRole } from "../../features/members/permissions";
export { hasPermission, permissionMatrix, roles } from "../../features/members/permissions";

export async function requireUser() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return current;
}

export async function requireVerifiedUser() {
  const current = await requireUser();
  if (!current.user.emailVerified)
    throw new AppError("EMAIL_NOT_VERIFIED", "Please verify your email first.", 403);
  return current;
}

export async function requireHomeAccess(homeId: string) {
  const current = await requireVerifiedUser();
  const [member] = await db
    .select()
    .from(homeMembers)
    .where(and(eq(homeMembers.homeId, homeId), eq(homeMembers.userId, current.user.id)))
    .limit(1);
  if (!member) throw new AppError("NOT_FOUND", "Home not found.", 404);
  return { session: current, member };
}

export async function requireHomeRole(homeId: string, allowed: readonly HomeRole[]) {
  const access = await requireHomeAccess(homeId);
  if (!allowed.includes(access.member.role))
    throw new AppError("FORBIDDEN", "You do not have permission to do that.", 403);
  return access;
}

export const canManageAsset = (homeId: string) => requireHomeRole(homeId, ["OWNER", "ADMIN"]);
export const canManageMembers = (homeId: string) => requireHomeRole(homeId, ["OWNER", "ADMIN"]);
export const canViewPrivateDocument = (homeId: string) => requireHomeRole(homeId, roles);
