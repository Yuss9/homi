import { db } from "@/db";
import { documents, storedFiles } from "@/db/schema";
import { requireHomeRole } from "@/src/server/authorization";
import { getEnv } from "@/src/server/env";
import { errorResponse, requestId } from "@/src/server/http";
import { enforceRateLimit } from "@/src/server/rate-limit";
import { getStorage } from "@/src/server/storage";
import {
  noOpVirusScanner,
  validateUpload,
} from "@/src/server/storage/validation";
import { sanitizeFilename } from "@/src/lib/utils";
import { replaceDocumentTags } from "@/src/server/services/document-tags";
import { z } from "zod";

const metadataSchema = z.object({
  homeId: z.string().uuid(),
  assetId: z.string().uuid().optional(),
  type: z.enum([
    "INVOICE",
    "WARRANTY",
    "MANUAL",
    "CERTIFICATE",
    "CONTRACT",
    "PHOTO",
    "OTHER",
  ]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  tags: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const id = requestId(request);
  let storageKey: string | undefined;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("A file is required.");
    const metadata = metadataSchema.parse(
      Object.fromEntries([...form.entries()].filter(([key]) => key !== "file")),
    );
    const { session } = await requireHomeRole(metadata.homeId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    await enforceRateLimit("upload", session.user.id, {
      limit: 20,
      windowSeconds: 60,
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = await validateUpload(
      bytes,
      file.type,
      getEnv().MAX_UPLOAD_BYTES,
      file.name,
    );
    const scan = await noOpVirusScanner.scan(bytes);
    if (!scan.clean)
      throw new Error("The file did not pass the security scan.");
    const storage = getStorage();
    const uploadedKey = await storage.put(bytes, validated.extension);
    storageKey = uploadedKey;
    const result = await db.transaction(async (tx) => {
      const [stored] = await tx
        .insert(storedFiles)
        .values({
          storageProvider: storage.provider,
          storageKey: uploadedKey,
          originalName: sanitizeFilename(file.name),
          mimeType: validated.mimeType,
          size: validated.size,
          checksum: validated.checksum,
          uploadedBy: session.user.id,
        })
        .returning();
      if (!stored) throw new Error("Could not store file metadata");
      const { tags, ...documentMetadata } = metadata;
      const [document] = await tx
        .insert(documents)
        .values({
          ...documentMetadata,
          fileId: stored.id,
          uploadedBy: session.user.id,
        })
        .returning();
      if (!document) throw new Error("Could not store document metadata");
      const documentTags = await replaceDocumentTags(
        tx,
        document.id,
        metadata.homeId,
        tags,
      );
      return { stored, document: { ...document, tags: documentTags } };
    });
    return Response.json({ ...result, requestId: id }, { status: 201 });
  } catch (error) {
    if (storageKey)
      await getStorage()
        .delete(storageKey)
        .catch(() => undefined);
    return errorResponse(error, id);
  }
}
