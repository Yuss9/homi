import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { replaceDocumentTags } from "@/src/server/services/document-tags";

const payloadSchema = z.object({
  tags: z.array(z.string()).max(10),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const id = requestId(request);
  try {
    const { documentId } = await context.params;
    const payload = payloadSchema.parse(await request.json());
    const [document] = await db
      .select({ id: documents.id, homeId: documents.homeId })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (!document) throw new AppError("NOT_FOUND", "Document not found.", 404);

    await requireHomeRole(document.homeId, ["OWNER", "ADMIN", "MEMBER"]);
    const tags = await db.transaction((tx) =>
      replaceDocumentTags(tx, document.id, document.homeId, payload.tags),
    );

    return Response.json({ tags, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
