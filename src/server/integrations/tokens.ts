import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, type ApiScope } from "@/db/connected-platform-schema";
import { homeMembers } from "@/db/schema";
import type { HomeRole } from "@/src/features/members/permissions";
import { AppError } from "@/src/server/errors";

export const apiScopes: readonly ApiScope[] = [
  "home:read",
  "maintenance:write",
  "repairs:write",
  "assets:read",
  "calendar:read",
  "widgets:read",
  "webhooks:manage",
];

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken(namespace: "api" | "calendar") {
  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const token = `homi_${namespace}_${prefix}_${secret}`;
  return { token, prefix, hash: hashToken(token) };
}

function tokenFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer "))
    throw new AppError("UNAUTHENTICATED", "A bearer API key is required.", 401);
  const token = header.slice(7).trim();
  if (!token.startsWith("homi_api_"))
    throw new AppError("UNAUTHENTICATED", "The API key is invalid.", 401);
  return token;
}

export async function authenticateApiKey(
  request: Request,
  requiredScope: ApiScope,
) {
  const token = tokenFromRequest(request);
  const digest = hashToken(token);
  const now = new Date();
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.tokenHash, digest),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!key) throw new AppError("UNAUTHENTICATED", "The API key is invalid.", 401);
  if (!key.scopes.includes(requiredScope))
    throw new AppError(
      "FORBIDDEN",
      `The API key does not include the ${requiredScope} scope.`,
      403,
    );

  await db
    .update(apiKeys)
    .set({ lastUsedAt: now, updatedAt: now })
    .where(eq(apiKeys.id, key.id));

  return {
    keyId: key.id,
    userId: key.userId,
    scopes: key.scopes,
    tokenPrefix: key.tokenPrefix,
  };
}

export async function requireApiHomeAccess(
  userId: string,
  homeId: string,
  allowedRoles?: readonly HomeRole[],
) {
  const [member] = await db
    .select()
    .from(homeMembers)
    .where(
      and(eq(homeMembers.userId, userId), eq(homeMembers.homeId, homeId)),
    )
    .limit(1);
  if (!member) throw new AppError("NOT_FOUND", "Home not found.", 404);
  if (allowedRoles && !allowedRoles.includes(member.role))
    throw new AppError(
      "FORBIDDEN",
      "The API key owner cannot perform this action in this home.",
      403,
    );
  return member;
}

export function constantTimeTokenMatch(candidate: string, expectedHash: string) {
  const candidateHash = Buffer.from(hashToken(candidate), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return (
    candidateHash.byteLength === expected.byteLength &&
    timingSafeEqual(candidateHash, expected)
  );
}
