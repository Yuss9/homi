import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents, storedFiles } from "@/db/schema";
import { canViewPrivateDocument } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { getStorage } from "@/src/server/storage";
import { sanitizeFilename } from "@/src/lib/utils";

function canRenderInline(mimeType: string) {
  return (
    mimeType === "application/json" ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("text/") ||
    mimeType.startsWith("video/")
  );
}

function byteRange(range: string | null, size: number) {
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    end >= size
  )
    return null;
  return { start, end };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const id = requestId(request);
  try {
    const { fileId } = await context.params;
    const [entry] = await db
      .select({ file: storedFiles, homeId: documents.homeId })
      .from(storedFiles)
      .innerJoin(documents, eq(documents.fileId, storedFiles.id))
      .where(and(eq(storedFiles.id, fileId), isNull(storedFiles.deletedAt)))
      .limit(1);
    if (!entry) throw new AppError("NOT_FOUND", "File not found.", 404);
    await canViewPrivateDocument(entry.homeId);
    const bytes = await getStorage().get(entry.file.storageKey);
    const filename = sanitizeFilename(entry.file.originalName).replaceAll(
      '"',
      "",
    );
    const previewRequested =
      new URL(request.url).searchParams.get("preview") === "1";
    const inline = previewRequested && canRenderInline(entry.file.mimeType);
    const range = inline
      ? byteRange(request.headers.get("range"), bytes.byteLength)
      : null;
    const body = range ? bytes.slice(range.start, range.end + 1) : bytes;
    return new Response(new Blob([body as BlobPart]), {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": entry.file.mimeType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "Accept-Ranges": "bytes",
        ...(range
          ? {
              "Content-Range": `bytes ${range.start}-${range.end}/${bytes.byteLength}`,
            }
          : {}),
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
