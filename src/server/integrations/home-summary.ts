import "server-only";

import {
  and,
  asc,
  count,
  eq,
  gte,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  sum,
} from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  documents,
  homes,
  maintenanceRecords,
  maintenanceTasks,
  repairRecords,
} from "@/db/schema";
import {
  calculateHomeHealth,
  getDateKey,
} from "@/src/features/dashboard/health";
import { AppError } from "@/src/server/errors";

function numeric(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getConnectedHomeSummary(homeId: string) {
  const [home] = await db
    .select()
    .from(homes)
    .where(and(eq(homes.id, homeId), isNull(homes.archivedAt)))
    .limit(1);
  if (!home) throw new AppError("NOT_FOUND", "Home not found.", 404);

  const now = new Date();
  const today = getDateKey(now, home.timezone);
  const inThirtyDays = getDateKey(
    new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    home.timezone,
  );
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const [
    upcoming,
    assetCountRows,
    taskCountRows,
    documentCountRows,
    overdueRows,
    criticalRows,
    attentionRows,
    repairRows,
    openRepairCountRows,
    expiredDocumentRows,
    warrantyRows,
    documentExpiryRows,
    maintenanceCostRows,
    repairCostRows,
  ] = await Promise.all([
    db
      .select({
        id: maintenanceTasks.id,
        title: maintenanceTasks.title,
        nextDueAt: maintenanceTasks.nextDueAt,
        priority: maintenanceTasks.priority,
        assetId: maintenanceTasks.assetId,
      })
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.homeId, homeId),
          isNull(maintenanceTasks.archivedAt),
        ),
      )
      .orderBy(asc(maintenanceTasks.nextDueAt))
      .limit(5),
    db
      .select({ value: count() })
      .from(assets)
      .where(and(eq(assets.homeId, homeId), isNull(assets.archivedAt))),
    db
      .select({ value: count() })
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.homeId, homeId),
          isNull(maintenanceTasks.archivedAt),
        ),
      ),
    db
      .select({ value: count() })
      .from(documents)
      .where(
        and(
          eq(documents.homeId, homeId),
          sql`"documents"."archived_at" is null`,
        ),
      ),
    db
      .select({ value: count() })
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.homeId, homeId),
          isNull(maintenanceTasks.archivedAt),
          lt(maintenanceTasks.nextDueAt, now),
        ),
      ),
    db
      .select({ value: count() })
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.homeId, homeId),
          isNull(maintenanceTasks.archivedAt),
          lt(maintenanceTasks.nextDueAt, now),
          eq(maintenanceTasks.priority, "CRITICAL"),
        ),
      ),
    db
      .select({ value: count() })
      .from(assets)
      .where(
        and(
          eq(assets.homeId, homeId),
          isNull(assets.archivedAt),
          or(
            eq(assets.status, "NEEDS_ATTENTION"),
            eq(assets.status, "UNDER_REPAIR"),
          ),
        ),
      ),
    db
      .select({
        id: repairRecords.id,
        title: repairRecords.title,
        status: repairRecords.status,
        assetId: repairRecords.assetId,
        issueDate: repairRecords.issueDate,
      })
      .from(repairRecords)
      .where(
        and(
          eq(repairRecords.homeId, homeId),
          sql`"repair_records"."archived_at" is null`,
          ne(repairRecords.status, "COMPLETED"),
          ne(repairRecords.status, "CANCELLED"),
        ),
      )
      .orderBy(asc(repairRecords.issueDate))
      .limit(5),
    db
      .select({ value: count() })
      .from(repairRecords)
      .where(
        and(
          eq(repairRecords.homeId, homeId),
          sql`"repair_records"."archived_at" is null`,
          ne(repairRecords.status, "COMPLETED"),
          ne(repairRecords.status, "CANCELLED"),
        ),
      ),
    db
      .select({ value: count() })
      .from(documents)
      .where(
        and(
          eq(documents.homeId, homeId),
          sql`"documents"."archived_at" is null`,
          lt(documents.expiryDate, today),
        ),
      ),
    db
      .select({ value: count() })
      .from(assets)
      .where(
        and(
          eq(assets.homeId, homeId),
          isNull(assets.archivedAt),
          gte(assets.warrantyEndDate, today),
          lte(assets.warrantyEndDate, inThirtyDays),
        ),
      ),
    db
      .select({ value: count() })
      .from(documents)
      .where(
        and(
          eq(documents.homeId, homeId),
          sql`"documents"."archived_at" is null`,
          gte(documents.expiryDate, today),
          lte(documents.expiryDate, inThirtyDays),
        ),
      ),
    db
      .select({ value: sum(maintenanceRecords.cost) })
      .from(maintenanceRecords)
      .where(
        and(
          eq(maintenanceRecords.homeId, homeId),
          gte(maintenanceRecords.completedAt, monthStart),
        ),
      ),
    db
      .select({ value: sum(repairRecords.cost) })
      .from(repairRecords)
      .where(
        and(
          eq(repairRecords.homeId, homeId),
          sql`"repair_records"."archived_at" is null`,
          gte(repairRecords.createdAt, monthStart),
        ),
      ),
  ]);

  const metrics = {
    assets: assetCountRows[0]?.value ?? 0,
    maintenanceTasks: taskCountRows[0]?.value ?? 0,
    documents: documentCountRows[0]?.value ?? 0,
    overdueMaintenance: overdueRows[0]?.value ?? 0,
    criticalOverdueMaintenance: criticalRows[0]?.value ?? 0,
    assetsNeedingAttention: attentionRows[0]?.value ?? 0,
    openRepairs: openRepairCountRows[0]?.value ?? 0,
    expiredDocuments: expiredDocumentRows[0]?.value ?? 0,
    warrantiesExpiringSoon: warrantyRows[0]?.value ?? 0,
    documentsExpiringSoon: documentExpiryRows[0]?.value ?? 0,
    monthlyCosts:
      numeric(maintenanceCostRows[0]?.value) +
      numeric(repairCostRows[0]?.value),
  };

  const health = calculateHomeHealth({
    overdueTasks: metrics.overdueMaintenance,
    criticalOverdueTasks: metrics.criticalOverdueMaintenance,
    openRepairs: metrics.openRepairs,
    attentionAssets: metrics.assetsNeedingAttention,
    expiredDocuments: metrics.expiredDocuments,
  });

  return {
    generatedAt: now.toISOString(),
    home: {
      id: home.id,
      name: home.name,
      timezone: home.timezone,
      currency: "EUR",
    },
    health,
    metrics,
    upcomingMaintenance: upcoming.map((task) => ({
      ...task,
      nextDueAt: task.nextDueAt.toISOString(),
      url: `/maintenance?task=${task.id}`,
    })),
    openRepairItems: repairRows.map((repair) => ({
      ...repair,
      url: `/repairs?repair=${repair.id}`,
    })),
    quickActions: {
      scan: "/scan",
      createMaintenance: "/maintenance?new=1",
      createRepair: "/repairs?new=1",
      calendar: "/calendar",
    },
  };
}
