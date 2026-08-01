import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  documents,
  documentTagAssignments,
  documentTags,
  storedFiles,
} from "@/db/schema";
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
    const tagRows = rows.length
      ? await db
          .select({
            documentId: documentTagAssignments.documentId,
            id: documentTags.id,
            name: documentTags.name,
          })
          .from(documentTagAssignments)
          .innerJoin(
            documentTags,
            eq(documentTags.id, documentTagAssignments.tagId),
          )
          .where(
            inArray(
              documentTagAssignments.documentId,
              rows.map((row) => row.id),
            ),
          )
      : [];
    const tagsByDocument = new Map<string, { id: string; name: string }[]>();
    for (const tag of tagRows) {
      const current = tagsByDocument.get(tag.documentId) ?? [];
      current.push({ id: tag.id, name: tag.name });
      tagsByDocument.set(tag.documentId, current);
    }
    return Response.json({
      documents: rows.map((row) => ({
        ...row,
        tags: (tagsByDocument.get(row.id) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      })),
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
