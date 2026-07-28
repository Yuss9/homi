import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents, storedFiles } from "@/db/schema";
import { canViewPrivateDocument } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { getStorage } from "@/src/server/storage";
import { sanitizeFilename } from "@/src/lib/utils";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
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
    const filename = sanitizeFilename(entry.file.originalName).replaceAll('"', "");
    return new Response(new Blob([bytes as BlobPart]), {
      headers: {
        "Content-Type": entry.file.mimeType,
        "Content-Length": String(entry.file.size),
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
