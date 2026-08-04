import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assets,
  maintenanceRecords,
  maintenanceTasks,
  repairRecords,
} from "@/db/schema";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const queryInput = z.object({
  homeId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

type CostEntry = {
  id: string;
  type: "MAINTENANCE" | "REPAIR";
  title: string;
  assetId: string | null;
  assetName: string | null;
  date: string;
  cost: number;
  currency: string;
  provider: string | null;
};

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const url = new URL(request.url);
    const body = queryInput.parse({
      homeId: url.searchParams.get("homeId"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    await requireHomeAccess(body.homeId);
    const fromDate = body.from.toISOString().slice(0, 10);
    const toDate = body.to.toISOString().slice(0, 10);

    const [maintenance, repairs] = await Promise.all([
      db
        .select({
          id: maintenanceRecords.id,
          title: maintenanceTasks.title,
          assetId: maintenanceRecords.assetId,
          assetName: assets.name,
          date: maintenanceRecords.completedAt,
          cost: maintenanceRecords.cost,
          currency: maintenanceRecords.currency,
          provider: maintenanceRecords.serviceProvider,
        })
        .from(maintenanceRecords)
        .leftJoin(
          maintenanceTasks,
          eq(maintenanceTasks.id, maintenanceRecords.taskId),
        )
        .leftJoin(assets, eq(assets.id, maintenanceRecords.assetId))
        .where(
          and(
            eq(maintenanceRecords.homeId, body.homeId),
            isNotNull(maintenanceRecords.cost),
            gte(maintenanceRecords.completedAt, body.from),
            lte(maintenanceRecords.completedAt, body.to),
          ),
        )
        .orderBy(desc(maintenanceRecords.completedAt)),
      db
        .select({
          id: repairRecords.id,
          title: repairRecords.title,
          assetId: repairRecords.assetId,
          assetName: assets.name,
          issueDate: repairRecords.issueDate,
          repairDate: repairRecords.repairDate,
          cost: repairRecords.cost,
          currency: repairRecords.currency,
          provider: repairRecords.provider,
        })
        .from(repairRecords)
        .innerJoin(assets, eq(assets.id, repairRecords.assetId))
        .where(
          and(
            eq(repairRecords.homeId, body.homeId),
            isNotNull(repairRecords.cost),
            sql`"repair_records"."archived_at" is null`,
            sql`coalesce(${repairRecords.repairDate}, ${repairRecords.issueDate}) between ${fromDate} and ${toDate}`,
          ),
        )
        .orderBy(desc(repairRecords.issueDate)),
    ]);

    const entries: CostEntry[] = [
      ...maintenance
        .filter((entry) => entry.cost !== null)
        .map((entry) => ({
          id: entry.id,
          type: "MAINTENANCE" as const,
          title: entry.title ?? "Maintenance work",
          assetId: entry.assetId,
          assetName: entry.assetName,
          date: entry.date.toISOString(),
          cost: Number(entry.cost),
          currency: entry.currency ?? "EUR",
          provider: entry.provider,
        })),
      ...repairs
        .filter((entry) => entry.cost !== null)
        .map((entry) => ({
          id: entry.id,
          type: "REPAIR" as const,
          title: entry.title,
          assetId: entry.assetId,
          assetName: entry.assetName,
          date: `${entry.repairDate ?? entry.issueDate}T12:00:00.000Z`,
          cost: Number(entry.cost),
          currency: entry.currency ?? "EUR",
          provider: entry.provider,
        })),
    ].sort((first, second) => second.date.localeCompare(first.date));

    const totals = new Map<
      string,
      { currency: string; maintenance: number; repairs: number; total: number }
    >();
    const monthly = new Map<
      string,
      { month: string; currency: string; maintenance: number; repairs: number; total: number }
    >();
    const byAsset = new Map<
      string,
      { assetId: string | null; assetName: string; currency: string; total: number }
    >();
    for (const entry of entries) {
      const total = totals.get(entry.currency) ?? {
        currency: entry.currency,
        maintenance: 0,
        repairs: 0,
        total: 0,
      };
      if (entry.type === "MAINTENANCE") total.maintenance += entry.cost;
      else total.repairs += entry.cost;
      total.total += entry.cost;
      totals.set(entry.currency, total);

      const month = entry.date.slice(0, 7);
      const monthKey = `${month}:${entry.currency}`;
      const bucket = monthly.get(monthKey) ?? {
        month,
        currency: entry.currency,
        maintenance: 0,
        repairs: 0,
        total: 0,
      };
      if (entry.type === "MAINTENANCE") bucket.maintenance += entry.cost;
      else bucket.repairs += entry.cost;
      bucket.total += entry.cost;
      monthly.set(monthKey, bucket);

      const assetKey = `${entry.assetId ?? "home"}:${entry.currency}`;
      const asset = byAsset.get(assetKey) ?? {
        assetId: entry.assetId,
        assetName: entry.assetName ?? "Whole home",
        currency: entry.currency,
        total: 0,
      };
      asset.total += entry.cost;
      byAsset.set(assetKey, asset);
    }

    return Response.json({
      totals: [...totals.values()].map((entry) => ({
        ...entry,
        maintenance: Number(entry.maintenance.toFixed(2)),
        repairs: Number(entry.repairs.toFixed(2)),
        total: Number(entry.total.toFixed(2)),
      })),
      monthly: [...monthly.values()]
        .sort((first, second) => first.month.localeCompare(second.month))
        .map((entry) => ({ ...entry, total: Number(entry.total.toFixed(2)) })),
      byAsset: [...byAsset.values()]
        .sort((first, second) => second.total - first.total)
        .slice(0, 8)
        .map((entry) => ({ ...entry, total: Number(entry.total.toFixed(2)) })),
      entries,
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
