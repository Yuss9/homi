import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys } from "@/db/connected-platform-schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const { keyId } = await params;
    const parsedId = z.string().uuid().parse(keyId);
    const [revoked] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(apiKeys.id, parsedId),
          eq(apiKeys.userId, session.user.id),
          isNull(apiKeys.revokedAt),
        ),
      )
      .returning({ id: apiKeys.id });
    if (!revoked) throw new AppError("NOT_FOUND", "API key not found.", 404);
    return Response.json({ ok: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
