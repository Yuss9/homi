import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, storedFiles } from "@/db/schema";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId)
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "homeId is required" } },
        { status: 400 },
      );
    await requireHomeAccess(homeId);
    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        type: documents.type,
        documentDate: documents.documentDate,
        expiryDate: documents.expiryDate,
        createdAt: documents.createdAt,
        fileId: documents.fileId,
        originalName: storedFiles.originalName,
        mimeType: storedFiles.mimeType,
        size: storedFiles.size,
      })
      .from(documents)
      .innerJoin(storedFiles, eq(storedFiles.id, documents.fileId))
      .where(eq(documents.homeId, homeId))
      .orderBy(desc(documents.createdAt))
      .limit(100);
    return Response.json({ documents: rows, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
