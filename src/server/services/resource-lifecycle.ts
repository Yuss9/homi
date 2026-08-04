import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assets,
  documents,
  homes,
  maintenanceTasks,
  repairRecords,
  rooms,
} from "@/db/schema";
import {
  requireAssetInHome,
  requireHomeAccess,
  requireHomeRole,
  requireMemberInHome,
  requireRoomInHome,
} from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";

const optionalDate = z.string().date().nullable().optional();
const optionalMoney = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/)
  .nullable()
  .optional();
const optionalCurrency = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .nullable()
  .optional();

export const homePatchInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  type: z.string().trim().min(1).max(40).optional(),
  addressLine: z.string().trim().max(180).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().max(24).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  constructionYear: z
    .number()
    .int()
    .min(1200)
    .max(new Date().getFullYear() + 2)
    .nullable()
    .optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
});

export const roomPatchInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  floor: z.string().trim().max(40).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
});

export const assetPatchInput = z
  .object({
    roomId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    brand: z.string().trim().max(80).nullable().optional(),
    model: z.string().trim().max(120).nullable().optional(),
    serialNumber: z.string().trim().max(160).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    purchaseDate: optionalDate,
    purchasePrice: optionalMoney,
    currency: optionalCurrency,
    retailer: z.string().trim().max(160).nullable().optional(),
    installationDate: optionalDate,
    warrantyStartDate: optionalDate,
    warrantyEndDate: optionalDate,
    expectedLifetimeYears: z.number().int().min(1).max(200).nullable().optional(),
    status: z
      .enum([
        "ACTIVE",
        "NEEDS_ATTENTION",
        "UNDER_REPAIR",
        "REPLACED",
        "ARCHIVED",
      ])
      .optional(),
  })
  .superRefine((input, context) => {
    if (
      input.warrantyStartDate &&
      input.warrantyEndDate &&
      input.warrantyEndDate < input.warrantyStartDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["warrantyEndDate"],
        message: "Warranty end date must be after its start date.",
      });
    }
  });

export const taskPatchInput = z.object({
  assetId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  frequencyType: z
    .enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"])
    .optional(),
  frequencyInterval: z.number().int().min(1).max(3650).optional(),
  nextDueAt: z.coerce.date().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export const repairPatchInput = z.object({
  assetId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  issueDate: z.string().date().optional(),
  repairDate: optionalDate,
  status: z
    .enum(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
  provider: z.string().trim().max(160).nullable().optional(),
  cost: optionalMoney,
  currency: optionalCurrency,
  warrantyClaim: z.boolean().optional(),
});

export const documentPatchInput = z
  .object({
    assetId: z.string().uuid().nullable().optional(),
    type: z
      .enum([
        "INVOICE",
        "WARRANTY",
        "MANUAL",
        "CERTIFICATE",
        "CONTRACT",
        "PHOTO",
        "OTHER",
      ])
      .optional(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    documentDate: optionalDate,
    expiryDate: optionalDate,
  })
  .superRefine((input, context) => {
    if (
      input.documentDate &&
      input.expiryDate &&
      input.expiryDate < input.documentDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be after the document date.",
      });
    }
  });

function notFound(resource: string): never {
  throw new AppError("NOT_FOUND", `${resource} not found.`, 404);
}

export async function getHome(homeId: string) {
  await requireHomeAccess(homeId);
  const [home] = await db
    .select()
    .from(homes)
    .where(and(eq(homes.id, homeId), isNull(homes.archivedAt)))
    .limit(1);
  if (!home) notFound("Home");
  return home;
}

export async function updateHome(homeId: string, raw: unknown) {
  await requireHomeRole(homeId, ["OWNER", "ADMIN"]);
  const input = homePatchInput.parse(raw);
  const [home] = await db
    .update(homes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(homes.id, homeId), isNull(homes.archivedAt)))
    .returning();
  if (!home) notFound("Home");
  return home;
}

export async function archiveHome(homeId: string) {
  await requireHomeRole(homeId, ["OWNER"]);
  const [home] = await db
    .update(homes)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(homes.id, homeId), isNull(homes.archivedAt)))
    .returning();
  if (!home) notFound("Home");
  return home;
}

export async function getRoom(roomId: string) {
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), sql`"rooms"."archived_at" is null`))
    .limit(1);
  if (!room) notFound("Room");
  await requireHomeAccess(room.homeId);
  return room;
}

export async function updateRoom(roomId: string, raw: unknown) {
  const room = await getRoom(roomId);
  await requireHomeRole(room.homeId, ["OWNER", "ADMIN"]);
  const input = roomPatchInput.parse(raw);
  const [updated] = await db
    .update(rooms)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(rooms.id, roomId))
    .returning();
  if (!updated) notFound("Room");
  return updated;
}

export async function archiveRoom(roomId: string) {
  const room = await getRoom(roomId);
  await requireHomeRole(room.homeId, ["OWNER", "ADMIN"]);
  const now = new Date();
  await db.execute(
    sql`update "rooms" set "archived_at" = ${now}, "updated_at" = ${now} where "id" = ${roomId} and "archived_at" is null`,
  );
  return { ...room, archivedAt: now };
}

export async function getAsset(assetId: string) {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), isNull(assets.archivedAt)))
    .limit(1);
  if (!asset) notFound("Asset");
  await requireHomeAccess(asset.homeId);
  return asset;
}

export async function updateAsset(assetId: string, raw: unknown) {
  const asset = await getAsset(assetId);
  await requireHomeRole(asset.homeId, ["OWNER", "ADMIN"]);
  const input = assetPatchInput.parse(raw);
  if (input.roomId) await requireRoomInHome(input.roomId, asset.homeId);
  const [updated] = await db
    .update(assets)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(assets.id, assetId), isNull(assets.archivedAt)))
    .returning();
  if (!updated) notFound("Asset");
  return updated;
}

export async function archiveAsset(assetId: string) {
  const asset = await getAsset(assetId);
  await requireHomeRole(asset.homeId, ["OWNER", "ADMIN"]);
  const [updated] = await db
    .update(assets)
    .set({ status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(assets.id, assetId), isNull(assets.archivedAt)))
    .returning();
  if (!updated) notFound("Asset");
  return updated;
}

export async function getTask(taskId: string) {
  const [task] = await db
    .select()
    .from(maintenanceTasks)
    .where(
      and(eq(maintenanceTasks.id, taskId), isNull(maintenanceTasks.archivedAt)),
    )
    .limit(1);
  if (!task) notFound("Maintenance task");
  await requireHomeAccess(task.homeId);
  return task;
}

export async function updateTask(taskId: string, raw: unknown) {
  const task = await getTask(taskId);
  await requireHomeRole(task.homeId, ["OWNER", "ADMIN"]);
  const input = taskPatchInput.parse(raw);
  if (input.assetId) await requireAssetInHome(input.assetId, task.homeId);
  if (input.assignedTo) await requireMemberInHome(input.assignedTo, task.homeId);
  const [updated] = await db
    .update(maintenanceTasks)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(eq(maintenanceTasks.id, taskId), isNull(maintenanceTasks.archivedAt)),
    )
    .returning();
  if (!updated) notFound("Maintenance task");
  return updated;
}

export async function archiveTask(taskId: string) {
  const task = await getTask(taskId);
  await requireHomeRole(task.homeId, ["OWNER", "ADMIN"]);
  const [updated] = await db
    .update(maintenanceTasks)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(maintenanceTasks.id, taskId), isNull(maintenanceTasks.archivedAt)),
    )
    .returning();
  if (!updated) notFound("Maintenance task");
  return updated;
}

export async function getRepair(repairId: string) {
  const [repair] = await db
    .select()
    .from(repairRecords)
    .where(
      and(
        eq(repairRecords.id, repairId),
        sql`"repair_records"."archived_at" is null`,
      ),
    )
    .limit(1);
  if (!repair) notFound("Repair");
  await requireHomeAccess(repair.homeId);
  return repair;
}

export async function updateRepair(repairId: string, raw: unknown) {
  const repair = await getRepair(repairId);
  await requireHomeRole(repair.homeId, ["OWNER", "ADMIN", "MEMBER"]);
  const input = repairPatchInput.parse(raw);
  if (input.assetId) await requireAssetInHome(input.assetId, repair.homeId);
  const [updated] = await db
    .update(repairRecords)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(repairRecords.id, repairId))
    .returning();
  if (!updated) notFound("Repair");
  return updated;
}

export async function archiveRepair(repairId: string) {
  const repair = await getRepair(repairId);
  await requireHomeRole(repair.homeId, ["OWNER", "ADMIN", "MEMBER"]);
  const now = new Date();
  await db.execute(
    sql`update "repair_records" set "archived_at" = ${now}, "updated_at" = ${now} where "id" = ${repairId} and "archived_at" is null`,
  );
  return { ...repair, archivedAt: now };
}

export async function getDocument(documentId: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        sql`"documents"."archived_at" is null`,
      ),
    )
    .limit(1);
  if (!document) notFound("Document");
  await requireHomeAccess(document.homeId);
  return document;
}

export async function updateDocument(documentId: string, raw: unknown) {
  const document = await getDocument(documentId);
  await requireHomeRole(document.homeId, ["OWNER", "ADMIN", "MEMBER"]);
  const input = documentPatchInput.parse(raw);
  if (input.assetId) await requireAssetInHome(input.assetId, document.homeId);
  const [updated] = await db
    .update(documents)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(documents.id, documentId))
    .returning();
  if (!updated) notFound("Document");
  return updated;
}

export async function archiveDocument(documentId: string) {
  const document = await getDocument(documentId);
  await requireHomeRole(document.homeId, ["OWNER", "ADMIN", "MEMBER"]);
  const now = new Date();
  await db.execute(
    sql`update "documents" set "archived_at" = ${now}, "updated_at" = ${now} where "id" = ${documentId} and "archived_at" is null`,
  );
  return { ...document, archivedAt: now };
}
