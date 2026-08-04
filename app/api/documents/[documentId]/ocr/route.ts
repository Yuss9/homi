import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documentOcr } from "@/db/connected-platform-schema";
import { documents } from "@/db/schema";
import { requireHomeAccess, requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

const input = z.object({
  text: z.string().trim().min(1).max(100_000),
  engine: z.enum(["BROWSER_TEXT_DETECTOR", "MANUAL"]).default("BROWSER_TEXT_DETECTOR"),
  language: z.string().trim().max(16).optional(),
});

async function documentHome(documentId: string) {
  const [document] = await db
    .select({ homeId: documents.homeId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!document) throw new AppError("NOT_FOUND", "Document not found.", 404);
  return document.homeId;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const id = requestId(request);
  try {
    const documentId = z.string().uuid().parse((await params).documentId);
    await requireHomeAccess(await documentHome(documentId));
    const [ocr] = await db
      .select()
      .from(documentOcr)
      .where(eq(documentOcr.documentId, documentId))
      .limit(1);
    return Response.json({ ocr: ocr ?? null, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const id = requestId(request);
  try {
    const documentId = z.string().uuid().parse((await params).documentId);
    const homeId = await documentHome(documentId);
    const { session } = await requireHomeRole(homeId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    const body = input.parse(await request.json());
    const [ocr] = await db
      .insert(documentOcr)
      .values({
        documentId,
        createdBy: session.user.id,
        text: body.text,
        engine: body.engine,
        language: body.language,
      })
      .onConflictDoUpdate({
        target: documentOcr.documentId,
        set: {
          text: body.text,
          engine: body.engine,
          language: body.language,
          createdBy: session.user.id,
          updatedAt: new Date(),
        },
      })
      .returning();
    return Response.json({ ocr, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
