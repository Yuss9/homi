import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, type ApiScope } from "@/db/connected-platform-schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import {
  apiScopes,
  createOpaqueToken,
} from "@/src/server/integrations/tokens";

const input = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z
    .array(z.enum(apiScopes as [ApiScope, ...ApiScope[]]))
    .min(1)
    .max(apiScopes.length),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        tokenPrefix: apiKeys.tokenPrefix,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(
        and(eq(apiKeys.userId, session.user.id), isNull(apiKeys.revokedAt)),
      )
      .orderBy(desc(apiKeys.createdAt));
    return Response.json({ keys, availableScopes: apiScopes, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const body = input.parse(await request.json());
    const active = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(
        and(eq(apiKeys.userId, session.user.id), isNull(apiKeys.revokedAt)),
      );
    if (active.length >= 20)
      throw new AppError(
        "CONFLICT",
        "Revoke an existing API key before creating another one.",
        409,
      );

    const generated = createOpaqueToken("api");
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    const [key] = await db
      .insert(apiKeys)
      .values({
        userId: session.user.id,
        name: body.name,
        tokenPrefix: generated.prefix,
        tokenHash: generated.hash,
        scopes: [...new Set(body.scopes)],
        expiresAt,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        tokenPrefix: apiKeys.tokenPrefix,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      });

    return Response.json(
      { key, token: generated.token, requestId: id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
