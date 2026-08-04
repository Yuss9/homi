import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assets,
  documents,
  maintenanceRecords,
  maintenanceTasks,
  repairRecords,
} from "@/db/schema";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const queryInput = z.object({
  homeId: z.string().uuid(),
  start: z.coerce.date(),
  end: z.coerce.date(),
});

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const url = new URL(request.url);
    const input = queryInput.parse({
      homeId: url.searchParams.get("homeId"),
      start: url.searchParams.get("start"),
      end: url.searchParams.get("end"),
    });
    await requireHomeAccess(input.homeId);
    if (input.end <= input.start) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "The calendar end must be after its start.",
          },
        },
        { status: 400 },
      );
    }

    const startDate = dateOnly(input.start);
    const endDate = dateOnly(input.end);
    const [tasks, completions, repairs, warranties, expiries] = await Promise.all([
      db
        .select({
          id: maintenanceTasks.id,
          title: maintenanceTasks.title,
          date: maintenanceTasks.nextDueAt,
          priority: maintenanceTasks.priority,
          assetId: maintenanceTasks.assetId,
          assetName: assets.name,
        })
        .from(maintenanceTasks)
        .leftJoin(assets, eq(assets.id, maintenanceTasks.assetId))
        .where(
          and(
            eq(maintenanceTasks.homeId, input.homeId),
            isNull(maintenanceTasks.archivedAt),
            gte(maintenanceTasks.nextDueAt, input.start),
            lte(maintenanceTasks.nextDueAt, input.end),
          ),
        )
        .orderBy(asc(maintenanceTasks.nextDueAt)),
      db
        .select({
          id: maintenanceRecords.id,
          taskId: maintenanceRecords.taskId,
          assetId: maintenanceRecords.assetId,
          title: maintenanceTasks.title,
          assetName: assets.name,
          date: maintenanceRecords.completedAt,
        })
        .from(maintenanceRecords)
        .leftJoin(
          maintenanceTasks,
          eq(maintenanceTasks.id, maintenanceRecords.taskId),
        )
        .leftJoin(assets, eq(assets.id, maintenanceRecords.assetId))
        .where(
          and(
            eq(maintenanceRecords.homeId, input.homeId),
            gte(maintenanceRecords.completedAt, input.start),
            lte(maintenanceRecords.completedAt, input.end),
          ),
        )
        .orderBy(asc(maintenanceRecords.completedAt)),
      db
        .select({
          id: repairRecords.id,
          title: repairRecords.title,
          issueDate: repairRecords.issueDate,
          repairDate: repairRecords.repairDate,
          status: repairRecords.status,
          assetId: repairRecords.assetId,
          assetName: assets.name,
        })
        .from(repairRecords)
        .innerJoin(assets, eq(assets.id, repairRecords.assetId))
        .where(
          and(
            eq(repairRecords.homeId, input.homeId),
            sql`"repair_records"."archived_at" is null`,
            or(
              and(
                gte(repairRecords.issueDate, startDate),
                lte(repairRecords.issueDate, endDate),
              ),
              and(
                gte(repairRecords.repairDate, startDate),
                lte(repairRecords.repairDate, endDate),
              ),
            ),
          ),
        ),
      db
        .select({
          id: assets.id,
          title: assets.name,
          date: assets.warrantyEndDate,
        })
        .from(assets)
        .where(
          and(
            eq(assets.homeId, input.homeId),
            isNull(assets.archivedAt),
            gte(assets.warrantyEndDate, startDate),
            lte(assets.warrantyEndDate, endDate),
          ),
        ),
      db
        .select({
          id: documents.id,
          title: documents.title,
          date: documents.expiryDate,
          assetId: documents.assetId,
        })
        .from(documents)
        .where(
          and(
            eq(documents.homeId, input.homeId),
            sql`"documents"."archived_at" is null`,
            gte(documents.expiryDate, startDate),
            lte(documents.expiryDate, endDate),
          ),
        ),
    ]);

    const events = [
      ...tasks.map((task) => ({
        id: `task:${task.id}`,
        type: "MAINTENANCE" as const,
        title: task.title,
        date: task.date.toISOString(),
        detail: [task.assetName, `${task.priority.toLowerCase()} priority`]
          .filter(Boolean)
          .join(" · "),
        href: "/maintenance",
      })),
      ...completions.map((record) => ({
        id: `completion:${record.id}`,
        type: "COMPLETED" as const,
        title: record.title ?? "Maintenance completed",
        date: record.date.toISOString(),
        detail: record.assetName ?? "Household maintenance",
        href: record.assetId ? `/assets/${record.assetId}` : "/maintenance/history",
      })),
      ...repairs.flatMap((repair) => {
        const result = [];
        if (repair.issueDate >= startDate && repair.issueDate <= endDate) {
          result.push({
            id: `repair-opened:${repair.id}`,
            type: "REPAIR" as const,
            title: repair.title,
            date: `${repair.issueDate}T12:00:00.000Z`,
            detail: `${repair.assetName} · ${repair.status.toLowerCase()}`,
            href: "/repairs",
          });
        }
        if (
          repair.repairDate &&
          repair.repairDate >= startDate &&
          repair.repairDate <= endDate
        ) {
          result.push({
            id: `repair-date:${repair.id}`,
            type: "REPAIR_DATE" as const,
            title: `${repair.title} repair date`,
            date: `${repair.repairDate}T12:00:00.000Z`,
            detail: repair.assetName,
            href: "/repairs",
          });
        }
        return result;
      }),
      ...warranties
        .filter((asset): asset is typeof asset & { date: string } => Boolean(asset.date))
        .map((asset) => ({
          id: `warranty:${asset.id}`,
          type: "WARRANTY" as const,
          title: `${asset.title} warranty ends`,
          date: `${asset.date}T12:00:00.000Z`,
          detail: "Warranty expiration",
          href: `/assets/${asset.id}`,
        })),
      ...expiries
        .filter((document): document is typeof document & { date: string } =>
          Boolean(document.date),
        )
        .map((document) => ({
          id: `document:${document.id}`,
          type: "DOCUMENT" as const,
          title: `${document.title} expires`,
          date: `${document.date}T12:00:00.000Z`,
          detail: "Document expiration",
          href: "/documents",
        })),
    ].sort((first, second) => first.date.localeCompare(second.date));

    return Response.json({ events, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
