import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { homeMembers, user } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { parseStoredAvatar } from "@/src/server/profile/avatar";
import { getStorage } from "@/src/server/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const { userId } = await context.params;

    if (userId !== session.user.id) {
      const ownHomes = await db
        .select({ homeId: homeMembers.homeId })
        .from(homeMembers)
        .where(eq(homeMembers.userId, session.user.id));
      if (!ownHomes.length)
        throw new AppError("NOT_FOUND", "Avatar not found.", 404);
      const [sharedMembership] = await db
        .select({ id: homeMembers.id })
        .from(homeMembers)
        .where(
          and(
            eq(homeMembers.userId, userId),
            inArray(
              homeMembers.homeId,
              ownHomes.map((membership) => membership.homeId),
            ),
          ),
        )
        .limit(1);
      if (!sharedMembership)
        throw new AppError("NOT_FOUND", "Avatar not found.", 404);
    }

    const [profile] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const avatar = parseStoredAvatar(profile?.image);
    if (!avatar) throw new AppError("NOT_FOUND", "Avatar not found.", 404);

    const etag = `"${avatar.checksum}"`;
    if (request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers: { ETag: etag } });

    const bytes = await getStorage().get(avatar.key);
    return new Response(new Blob([bytes as BlobPart]), {
      headers: {
        "Content-Type": avatar.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=300, must-revalidate",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
        ETag: etag,
      },
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
