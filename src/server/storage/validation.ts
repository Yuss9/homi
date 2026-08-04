import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../errors";

const safeTextMimeTypes = new Set([
  "application/json",
  "text/csv",
  "text/markdown",
  "text/plain",
]);

function isText(bytes: Uint8Array) {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function safeExtension(originalName: string, detectedExtension?: string) {
  if (detectedExtension) return detectedExtension;
  const extension = originalName.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{1,12}$/.test(extension) ? extension : "bin";
}

export async function validateUpload(
  bytes: Uint8Array,
  declaredMime: string,
  maxBytes = 10 * 1024 * 1024,
  originalName = "file.bin",
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
  const isPdf =
    bytes.byteLength >= 5 &&
    new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const declaredTextMime = safeTextMimeTypes.has(declaredMime)
    ? declaredMime
    : "text/plain";
  const mime = isPdf
    ? "application/pdf"
    : (detected?.mime ??
      (isText(bytes) ? declaredTextMime : "application/octet-stream"));

  return {
    mimeType: mime,
    size: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    extension: isPdf ? "pdf" : safeExtension(originalName, detected?.ext),
  };
}
