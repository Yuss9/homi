import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { enforceRateLimit } from "@/src/server/rate-limit";
import {
  encodeStoredAvatar,
  isAllowedAvatarMime,
  parseStoredAvatar,
  profileAvatarUrl,
  safeExternalAvatarUrl,
} from "@/src/server/profile/avatar";
import { assertUploadIsClean } from "@/src/server/security/virus-scanner";
import { getStorage } from "@/src/server/storage";
import { validateUpload } from "@/src/server/storage/validation";

const avatarLimit = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const id = requestId(request);
  let uploadedKey: string | undefined;
  try {
    const session = await requireVerifiedUser();
    await enforceRateLimit("avatar-upload", session.user.id, {
      limit: 10,
      windowSeconds: 3600,
    });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AppError("VALIDATION_ERROR", "An image is required.", 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = await validateUpload(
      bytes,
      file.type,
      avatarLimit,
      file.name,
    );
    if (!isAllowedAvatarMime(validated.mimeType))
      throw new AppError(
        "VALIDATION_ERROR",
        "Use a PNG, JPEG, WebP, GIF, or AVIF image.",
        400,
      );
    await assertUploadIsClean(bytes, "image");

    const [current] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    if (!current) throw new AppError("NOT_FOUND", "Profile not found.", 404);

    const previousAvatar = parseStoredAvatar(current.image);
    const storage = getStorage();
    uploadedKey = await storage.put(bytes, validated.extension);
    const encoded = encodeStoredAvatar({
      key: uploadedKey,
      mimeType: validated.mimeType,
      checksum: validated.checksum,
      size: validated.size,
      fallbackImage:
        previousAvatar?.fallbackImage ?? safeExternalAvatarUrl(current.image),
    });

    try {
      await db
        .update(user)
        .set({ image: encoded, updatedAt: new Date() })
        .where(eq(user.id, session.user.id));
    } catch (error) {
      await storage.delete(uploadedKey).catch(() => undefined);
      uploadedKey = undefined;
      throw error;
    }

    if (previousAvatar)
      await storage.delete(previousAvatar.key).catch(() => undefined);

    return Response.json({
      avatarUrl: profileAvatarUrl(session.user.id, encoded),
      requestId: id,
    });
  } catch (error) {
    if (uploadedKey)
      await getStorage()
        .delete(uploadedKey)
        .catch(() => undefined);
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const [current] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    if (!current) throw new AppError("NOT_FOUND", "Profile not found.", 404);
    const avatar = parseStoredAvatar(current.image);
    const restoredImage = avatar?.fallbackImage ?? null;
    await db
      .update(user)
      .set({ image: restoredImage, updatedAt: new Date() })
      .where(eq(user.id, session.user.id));
    if (avatar) await getStorage().delete(avatar.key).catch(() => undefined);
    return Response.json({
      avatarUrl: profileAvatarUrl(session.user.id, restoredImage),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
