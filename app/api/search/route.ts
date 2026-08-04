import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
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
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const url = new URL(request.url);
    const body = input.parse({
      homeId: url.searchParams.get("homeId"),
      q: url.searchParams.get("q"),
    });
    await requireHomeAccess(body.homeId);
    const pattern = `%${body.q}%`;

    const [assetRows, roomRows, taskRows, repairRows, documentRows, memberRows, templateRows] =
      await Promise.all([
        db
          .select({
            id: assets.id,
            title: assets.name,
            category: assets.category,
            brand: assets.brand,
            model: assets.model,
          })
          .from(assets)
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
              ),
            ),
          )
          .limit(8),
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
          .limit(6),
        db
          .select({
            id: maintenanceTasks.id,
            title: maintenanceTasks.title,
            description: maintenanceTasks.description,
            priority: maintenanceTasks.priority,
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
          .limit(8),
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
          .limit(8),
        db
          .select({
            id: documents.id,
            title: documents.title,
            description: documents.description,
            type: documents.type,
          })
          .from(documents)
          .where(
            and(
              eq(documents.homeId, body.homeId),
              sql`"documents"."archived_at" is null`,
              or(
                ilike(documents.title, pattern),
                ilike(documents.description, pattern),
              ),
            ),
          )
          .limit(8),
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
          .limit(6),
        db
          .select({
            id: maintenanceTemplates.id,
            title: maintenanceTemplates.title,
            category: maintenanceTemplates.category,
            description: maintenanceTemplates.description,
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
          .limit(6),
      ]);

    const results = [
      ...assetRows.map((asset) => ({
        id: `asset:${asset.id}`,
        type: "Asset",
        title: asset.title,
        subtitle: [asset.category, asset.brand, asset.model]
          .filter(Boolean)
          .join(" · "),
        href: `/assets/${asset.id}`,
      })),
      ...roomRows.map((room) => ({
        id: `room:${room.id}`,
        type: "Room",
        title: room.title,
        subtitle: room.floor || "Room",
        href: "/homes",
      })),
      ...taskRows.map((task) => ({
        id: `task:${task.id}`,
        type: "Maintenance",
        title: task.title,
        subtitle: `${task.priority.toLowerCase()} priority`,
        href: "/maintenance",
      })),
      ...repairRows.map((repair) => ({
        id: `repair:${repair.id}`,
        type: "Repair",
        title: repair.title,
        subtitle: [repair.status.toLowerCase(), repair.provider]
          .filter(Boolean)
          .join(" · "),
        href: "/repairs",
      })),
      ...documentRows.map((document) => ({
        id: `document:${document.id}`,
        type: "Document",
        title: document.title,
        subtitle: document.type.toLowerCase(),
        href: "/documents",
      })),
      ...memberRows.map((member) => ({
        id: `member:${member.id}`,
        type: "Household",
        title: member.title,
        subtitle: `${member.email} · ${member.role.toLowerCase()}`,
        href: "/members",
      })),
      ...templateRows.map((template) => ({
        id: `template:${template.id}`,
        type: "Template",
        title: template.title,
        subtitle: template.category,
        href: "/maintenance/templates",
      })),
    ].slice(0, 30);

    return Response.json({ results, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
