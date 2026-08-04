import "server-only";

import { Buffer } from "node:buffer";
import { z } from "zod";

const avatarPrefix = "homi-avatar:";
const avatarMetadataSchema = z.object({
  key: z.string().min(1).max(500),
  mimeType: z.enum([
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().positive().max(5 * 1024 * 1024),
  fallbackImage: z.string().url().max(2048).nullable().optional(),
});

export type StoredAvatar = z.infer<typeof avatarMetadataSchema>;

export function isAllowedAvatarMime(
  mimeType: string,
): mimeType is StoredAvatar["mimeType"] {
  return avatarMetadataSchema.shape.mimeType.safeParse(mimeType).success;
}

export function safeExternalAvatarUrl(value: string | null | undefined) {
  if (!value || value.startsWith(avatarPrefix)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function encodeStoredAvatar(metadata: StoredAvatar) {
  const parsed = avatarMetadataSchema.parse(metadata);
  return `${avatarPrefix}${Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url")}`;
}

export function parseStoredAvatar(value: string | null | undefined) {
  if (!value?.startsWith(avatarPrefix)) return null;
  try {
    const decoded = Buffer.from(value.slice(avatarPrefix.length), "base64url").toString(
      "utf8",
    );
    return avatarMetadataSchema.parse(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function profileAvatarUrl(
  userId: string,
  image: string | null | undefined,
) {
  const stored = parseStoredAvatar(image);
  if (stored)
    return `/api/profile/avatar/${userId}?v=${stored.checksum.slice(0, 12)}`;
  return safeExternalAvatarUrl(image);
}
