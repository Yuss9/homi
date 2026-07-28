import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../errors";

export const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export async function validateUpload(
  bytes: Uint8Array,
  declaredMime: string,
  maxBytes = 10 * 1024 * 1024,
) {
  if (bytes.byteLength === 0)
    throw new AppError("VALIDATION_ERROR", "The selected file is empty.", 400);
  if (bytes.byteLength > maxBytes)
    throw new AppError(
      "VALIDATION_ERROR",
      `The file exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit.`,
      413,
    );

  const detected = await fileTypeFromBuffer(bytes);
  const isPdf = bytes.byteLength >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const mime = isPdf ? "application/pdf" : detected?.mime;

  if (!mime || !allowedMimeTypes.includes(mime as (typeof allowedMimeTypes)[number]))
    throw new AppError("VALIDATION_ERROR", "Only PDF, JPEG, PNG, and WebP files are allowed.", 415);
  if (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== mime)
    throw new AppError("VALIDATION_ERROR", "The file contents do not match its reported type.", 415);

  return {
    mimeType: mime,
    size: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    extension: mime === "application/pdf" ? "pdf" : mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1],
  };
}

export interface VirusScanner {
  scan(bytes: Uint8Array): Promise<{ clean: boolean; reason?: string }>;
}

export const noOpVirusScanner: VirusScanner = {
  async scan() {
    return { clean: true };
  },
};

