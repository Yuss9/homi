import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  maintenanceRecordDocuments,
  renovationDocuments,
  renovationProjects,
  repairDocuments,
} from "@/db/maintenance-operations-schema";
import {
  documents,
  maintenanceRecords,
  repairRecords,
  storedFiles,
} from "@/db/schema";
import { requireHomeRole } from "@/src/server/authorization";
import { getEnv } from "@/src/server/env";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { sanitizeFilename } from "@/src/lib/utils";
import { enforceRateLimit } from "@/src/server/rate-limit";
import { assertUploadIsClean } from "@/src/server/security/virus-scanner";
import { getStorage } from "@/src/server/storage";
import { validateUpload } from "@/src/server/storage/validation";

const targetType = z.enum(["MAINTENANCE_RECORD", "REPAIR", "RENOVATION"]);
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const metadataInput = z.object({
  homeId: z.string().uuid(),
  targetType,
  targetId: z.string().uuid(),
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
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000).optional(),
  ),
  documentDate: z.preprocess(emptyToUndefined, z.string().date().optional()),
  expiryDate: z.preprocess(emptyToUndefined, z.string().date().optional()),
});

type TargetType = z.infer<typeof targetType>;

async function resolveTarget(homeId: string, type: TargetType, targetId: string) {
  if (type === "MAINTENANCE_RECORD") {
    const [record] = await db
      .select({
        homeId: maintenanceRecords.homeId,
        assetId: maintenanceRecords.assetId,
      })
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.id, targetId))
      .limit(1);
    if (!record || record.homeId !== homeId)
      throw new AppError("NOT_FOUND", "Maintenance record not found.", 404);
    return { assetId: record.assetId };
  }
  if (type === "REPAIR") {
    const [repair] = await db
      .select({ homeId: repairRecords.homeId, assetId: repairRecords.assetId })
      .from(repairRecords)
      .where(eq(repairRecords.id, targetId))
      .limit(1);
    if (!repair || repair.homeId !== homeId)
      throw new AppError("NOT_FOUND", "Repair not found.", 404);
    return { assetId: repair.assetId };
  }
  const [project] = await db
    .select({ id: renovationProjects.id })
    .from(renovationProjects)
    .where(
      and(
        eq(renovationProjects.id, targetId),
        eq(renovationProjects.homeId, homeId),
      ),
    )
    .limit(1);
  if (!project)
    throw new AppError("NOT_FOUND", "Renovation project not found.", 404);
  return { assetId: null };
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const input = z
      .object({
        homeId: z.string().uuid(),
        targetType,
        targetId: z.string().uuid(),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    await requireHomeRole(input.homeId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
    await resolveTarget(input.homeId, input.targetType, input.targetId);

    const links =
      input.targetType === "MAINTENANCE_RECORD"
        ? await db
            .select({ documentId: maintenanceRecordDocuments.documentId })
            .from(maintenanceRecordDocuments)
            .where(eq(maintenanceRecordDocuments.maintenanceRecordId, input.targetId))
        : input.targetType === "REPAIR"
          ? await db
              .select({ documentId: repairDocuments.documentId })
              .from(repairDocuments)
              .where(eq(repairDocuments.repairId, input.targetId))
          : await db
              .select({ documentId: renovationDocuments.documentId })
              .from(renovationDocuments)
              .where(eq(renovationDocuments.projectId, input.targetId));
    const ids = links.map((link) => link.documentId);
    if (!ids.length) return Response.json({ attachments: [], requestId: id });
    const attachments = await db
      .select({
        id: documents.id,
        title: documents.title,
        type: documents.type,
        description: documents.description,
        documentDate: documents.documentDate,
        createdAt: documents.createdAt,
        fileId: documents.fileId,
        originalName: storedFiles.originalName,
        mimeType: storedFiles.mimeType,
        size: storedFiles.size,
      })
      .from(documents)
      .innerJoin(storedFiles, eq(storedFiles.id, documents.fileId))
      .where(
        and(
          eq(documents.homeId, input.homeId),
          inArray(documents.id, ids),
        ),
      )
      .orderBy(desc(documents.createdAt));
    return Response.json({ attachments, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  let storageKey: string | undefined;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AppError("VALIDATION_ERROR", "A file is required.", 400);
    const metadata = metadataInput.parse(
      Object.fromEntries([...form.entries()].filter(([key]) => key !== "file")),
    );
    const { session } = await requireHomeRole(metadata.homeId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
    const target = await resolveTarget(
      metadata.homeId,
      metadata.targetType,
      metadata.targetId,
    );
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
    await assertUploadIsClean(bytes);
    const storage = getStorage();
    storageKey = await storage.put(bytes, validated.extension);
    const result = await db.transaction(async (tx) => {
      const [stored] = await tx
        .insert(storedFiles)
        .values({
          storageProvider: storage.provider,
          storageKey: storageKey!,
          originalName: sanitizeFilename(file.name),
          mimeType: validated.mimeType,
          size: validated.size,
          checksum: validated.checksum,
          uploadedBy: session.user.id,
        })
        .returning();
      if (!stored) throw new Error("Could not store file metadata.");
      const [document] = await tx
        .insert(documents)
        .values({
          homeId: metadata.homeId,
          assetId: target.assetId,
          uploadedBy: session.user.id,
          fileId: stored.id,
          type: metadata.type,
          title: metadata.title,
          description: metadata.description,
          documentDate: metadata.documentDate,
          expiryDate: metadata.expiryDate,
        })
        .returning();
      if (!document) throw new Error("Could not store document metadata.");
      if (metadata.targetType === "MAINTENANCE_RECORD") {
        await tx.insert(maintenanceRecordDocuments).values({
          maintenanceRecordId: metadata.targetId,
          documentId: document.id,
        });
      } else if (metadata.targetType === "REPAIR") {
        await tx.insert(repairDocuments).values({
          repairId: metadata.targetId,
          documentId: document.id,
        });
      } else {
        await tx.insert(renovationDocuments).values({
          projectId: metadata.targetId,
          documentId: document.id,
        });
      }
      return { stored, document };
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

export async function DELETE(request: Request) {
  const id = requestId(request);
  try {
    const input = z
      .object({
        homeId: z.string().uuid(),
        targetType,
        targetId: z.string().uuid(),
        documentId: z.string().uuid(),
      })
      .parse(await request.json());
    await requireHomeRole(input.homeId, ["OWNER", "ADMIN", "MEMBER"]);
    await resolveTarget(input.homeId, input.targetType, input.targetId);
    if (input.targetType === "MAINTENANCE_RECORD") {
      await db
        .delete(maintenanceRecordDocuments)
        .where(
          and(
            eq(maintenanceRecordDocuments.maintenanceRecordId, input.targetId),
            eq(maintenanceRecordDocuments.documentId, input.documentId),
          ),
        );
    } else if (input.targetType === "REPAIR") {
      await db
        .delete(repairDocuments)
        .where(
          and(
            eq(repairDocuments.repairId, input.targetId),
            eq(repairDocuments.documentId, input.documentId),
          ),
        );
    } else {
      await db
        .delete(renovationDocuments)
        .where(
          and(
            eq(renovationDocuments.projectId, input.targetId),
            eq(renovationDocuments.documentId, input.documentId),
          ),
        );
    }
    return Response.json({ success: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
