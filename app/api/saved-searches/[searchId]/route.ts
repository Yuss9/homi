import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { savedSearches } from "@/db/connected-platform-schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const searchId = z.string().uuid().parse((await params).searchId);
    const [deleted] = await db
      .delete(savedSearches)
      .where(
        and(
          eq(savedSearches.id, searchId),
          eq(savedSearches.userId, session.user.id),
        ),
      )
      .returning({ id: savedSearches.id });
    if (!deleted) throw new AppError("NOT_FOUND", "Saved search not found.", 404);
    return Response.json({ ok: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
