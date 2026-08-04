import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assetIdentifiers,
  documentOcr,
} from "@/db/connected-platform-schema";
import { maintenanceTemplates } from "@/db/high-value-schema";
import {
  assets,
  documents,
  homeMembers,
  maintenanceTasks,
  repairRecords,
  rooms,
  user,
} from "@/db/schema";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const input = z.object({
  homeId: z.string().uuid(),
  q: z.string().trim().min(2).max(80),
  types: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  statuses: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});

type Result = {
  id: string;
  type: string;
  status: string;
  title: string;
  subtitle: string;
  href: string;
};

function csv(value: string | null) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const url = new URL(request.url);
    const body = input.parse({
      homeId: url.searchParams.get("homeId"),
      q: url.searchParams.get("q"),
      types: csv(url.searchParams.get("types")),
      statuses: csv(url.searchParams.get("statuses")),
    });
    await requireHomeAccess(body.homeId);
    const pattern = `%${body.q.replaceAll("%", "\\%")}%`;
    const now = new Date();

    const [
      assetRows,
      roomRows,
      taskRows,
      repairRows,
      documentRows,
      memberRows,
      templateRows,
    ] = await Promise.all([
      db
        .select({
          id: assets.id,
          title: assets.name,
          category: assets.category,
          brand: assets.brand,
          model: assets.model,
          status: assets.status,
          barcode: assetIdentifiers.barcode,
        })
        .from(assets)
        .leftJoin(assetIdentifiers, eq(assetIdentifiers.assetId, assets.id))
        .where(
          and(
            eq(assets.homeId, body.homeId),
            isNull(assets.archivedAt),
            or(
              ilike(assets.name, pattern),
              ilike(assets.category, pattern),
              ilike(assets.brand, pattern),
              ilike(assets.model, pattern),
              ilike(assets.serialNumber, pattern),
              ilike(assetIdentifiers.barcode, pattern),
            ),
          ),
        )
        .limit(12),
      db
        .select({ id: rooms.id, title: rooms.name, floor: rooms.floor })
        .from(rooms)
        .where(
          and(
            eq(rooms.homeId, body.homeId),
            sql`"rooms"."archived_at" is null`,
            or(ilike(rooms.name, pattern), ilike(rooms.floor, pattern)),
          ),
        )
        .limit(8),
      db
        .select({
          id: maintenanceTasks.id,
          title: maintenanceTasks.title,
          description: maintenanceTasks.description,
          priority: maintenanceTasks.priority,
          nextDueAt: maintenanceTasks.nextDueAt,
        })
        .from(maintenanceTasks)
        .where(
          and(
            eq(maintenanceTasks.homeId, body.homeId),
            isNull(maintenanceTasks.archivedAt),
            or(
              ilike(maintenanceTasks.title, pattern),
              ilike(maintenanceTasks.description, pattern),
            ),
          ),
        )
        .limit(12),
      db
        .select({
          id: repairRecords.id,
          title: repairRecords.title,
          description: repairRecords.description,
          provider: repairRecords.provider,
          status: repairRecords.status,
        })
        .from(repairRecords)
        .where(
          and(
            eq(repairRecords.homeId, body.homeId),
            sql`"repair_records"."archived_at" is null`,
            or(
              ilike(repairRecords.title, pattern),
              ilike(repairRecords.description, pattern),
              ilike(repairRecords.provider, pattern),
            ),
          ),
        )
        .limit(12),
      db
        .select({
          id: documents.id,
          title: documents.title,
          description: documents.description,
          type: documents.type,
          ocrText: documentOcr.text,
        })
        .from(documents)
        .leftJoin(documentOcr, eq(documentOcr.documentId, documents.id))
        .where(
          and(
            eq(documents.homeId, body.homeId),
            sql`"documents"."archived_at" is null`,
            or(
              ilike(documents.title, pattern),
              ilike(documents.description, pattern),
              ilike(documentOcr.text, pattern),
            ),
          ),
        )
        .limit(12),
      db
        .select({
          id: homeMembers.id,
          title: user.name,
          email: user.email,
          role: homeMembers.role,
        })
        .from(homeMembers)
        .innerJoin(user, eq(user.id, homeMembers.userId))
        .where(
          and(
            eq(homeMembers.homeId, body.homeId),
            or(ilike(user.name, pattern), ilike(user.email, pattern)),
          ),
        )
        .limit(8),
      db
        .select({
          id: maintenanceTemplates.id,
          title: maintenanceTemplates.title,
          category: maintenanceTemplates.category,
          description: maintenanceTemplates.description,
          priority: maintenanceTemplates.priority,
        })
        .from(maintenanceTemplates)
        .where(
          and(
            eq(maintenanceTemplates.homeId, body.homeId),
            isNull(maintenanceTemplates.archivedAt),
            or(
              ilike(maintenanceTemplates.title, pattern),
              ilike(maintenanceTemplates.category, pattern),
              ilike(maintenanceTemplates.description, pattern),
            ),
          ),
        )
        .limit(8),
    ]);

    const allResults: Result[] = [
      ...assetRows.map((asset) => ({
        id: `asset:${asset.id}`,
        type: "Asset",
        status: asset.status,
        title: asset.title,
        subtitle: [asset.category, asset.brand, asset.model, asset.barcode]
          .filter(Boolean)
          .join(" · "),
        href: `/assets/${asset.id}`,
      })),
      ...roomRows.map((room) => ({
        id: `room:${room.id}`,
        type: "Room",
        status: "ACTIVE",
        title: room.title,
        subtitle: room.floor || "Room",
        href: "/homes",
      })),
      ...taskRows.map((task) => ({
        id: `task:${task.id}`,
        type: "Maintenance",
        status: task.nextDueAt < now ? "OVERDUE" : task.priority,
        title: task.title,
        subtitle: `${task.priority.toLowerCase()} priority`,
        href: `/maintenance?task=${task.id}`,
      })),
      ...repairRows.map((repair) => ({
        id: `repair:${repair.id}`,
        type: "Repair",
        status: repair.status,
        title: repair.title,
        subtitle: [repair.status.toLowerCase(), repair.provider]
          .filter(Boolean)
          .join(" · "),
        href: `/repairs?repair=${repair.id}`,
      })),
      ...documentRows.map((document) => ({
        id: `document:${document.id}`,
        type: "Document",
        status: document.type,
        title: document.title,
        subtitle: `${document.type.toLowerCase()}${document.ocrText ? " · OCR indexed" : ""}`,
        href: `/documents?document=${document.id}`,
      })),
      ...memberRows.map((member) => ({
        id: `member:${member.id}`,
        type: "Household",
        status: member.role,
        title: member.title,
        subtitle: `${member.email} · ${member.role.toLowerCase()}`,
        href: "/members",
      })),
      ...templateRows.map((template) => ({
        id: `template:${template.id}`,
        type: "Template",
        status: template.priority,
        title: template.title,
        subtitle: template.category,
        href: "/maintenance/templates",
      })),
    ];

    const selectedTypes = new Set(body.types.map((value) => value.toLowerCase()));
    const selectedStatuses = new Set(
      body.statuses.map((value) => value.toLowerCase()),
    );
    const results = allResults
      .filter(
        (result) =>
          (!selectedTypes.size || selectedTypes.has(result.type.toLowerCase())) &&
          (!selectedStatuses.size ||
            selectedStatuses.has(result.status.toLowerCase())),
      )
      .slice(0, 40);

    const facets = {
      types: Object.entries(
        allResults.reduce<Record<string, number>>((counts, result) => {
          counts[result.type] = (counts[result.type] ?? 0) + 1;
          return counts;
        }, {}),
      ).map(([value, count]) => ({ value, count })),
      statuses: Object.entries(
        allResults.reduce<Record<string, number>>((counts, result) => {
          counts[result.status] = (counts[result.status] ?? 0) + 1;
          return counts;
        }, {}),
      ).map(([value, count]) => ({ value, count })),
    };

    return Response.json({ results, facets, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
