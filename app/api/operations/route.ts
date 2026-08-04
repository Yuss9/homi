import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceTemplates } from "@/db/high-value-schema";
import {
  assetReplacementLinks,
  homeBudgets,
  insuranceItems,
  inventoryItems,
  inventoryMovements,
  maintenanceRecurrenceRules,
  maintenanceScheduleEvents,
  maintenanceTaskChecklistItems,
  maintenanceTemplateChecklistItems,
  providerInterventions,
  renovationDocuments,
  renovationProjects,
  renovationQuotes,
  renovationTasks,
  serviceProviders,
} from "@/db/maintenance-operations-schema";
import {
  assets,
  documents,
  homeMembers,
  maintenanceRecords,
  maintenanceTasks,
  notifications,
  repairRecords,
  rooms,
} from "@/db/schema";
import {
  requireAssetInHome,
  requireDocumentInHome,
  requireHomeAccess,
  requireHomeRole,
  requireMemberInHome,
  requireRoomInHome,
} from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";

const homeInput = z.object({ homeId: z.string().uuid() });
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
const optionalUuid = z.string().uuid().optional().nullable();

async function taskInHome(taskId: string, homeId: string) {
  const [task] = await db
    .select()
    .from(maintenanceTasks)
    .where(and(eq(maintenanceTasks.id, taskId), eq(maintenanceTasks.homeId, homeId)))
    .limit(1);
  if (!task) throw new AppError("NOT_FOUND", "Maintenance task not found.", 404);
  return task;
}

async function templateInHome(templateId: string, homeId: string) {
  const [template] = await db
    .select()
    .from(maintenanceTemplates)
    .where(
      and(
        eq(maintenanceTemplates.id, templateId),
        eq(maintenanceTemplates.homeId, homeId),
        isNull(maintenanceTemplates.archivedAt),
      ),
    )
    .limit(1);
  if (!template)
    throw new AppError("NOT_FOUND", "Maintenance template not found.", 404);
  return template;
}

async function projectInHome(projectId: string, homeId: string) {
  const [project] = await db
    .select()
    .from(renovationProjects)
    .where(
      and(
        eq(renovationProjects.id, projectId),
        eq(renovationProjects.homeId, homeId),
        isNull(renovationProjects.archivedAt),
      ),
    )
    .limit(1);
  if (!project)
    throw new AppError("NOT_FOUND", "Renovation project not found.", 404);
  return project;
}

async function providerInHome(providerId: string, homeId: string) {
  const [provider] = await db
    .select()
    .from(serviceProviders)
    .where(
      and(
        eq(serviceProviders.id, providerId),
        eq(serviceProviders.homeId, homeId),
        isNull(serviceProviders.archivedAt),
      ),
    )
    .limit(1);
  if (!provider)
    throw new AppError("NOT_FOUND", "Service provider not found.", 404);
  return provider;
}

async function notifyLowStock(homeId: string, item: typeof inventoryItems.$inferSelect) {
  if (item.quantity > item.reorderThreshold) return;
  const members = await db
    .select({ userId: homeMembers.userId })
    .from(homeMembers)
    .where(eq(homeMembers.homeId, homeId));
  if (!members.length) return;
  await db.insert(notifications).values(
    members.map(({ userId }) => ({
      userId,
      homeId,
      type: "LOW_STOCK",
      title: "A household supply is running low",
      message: `${item.name}: ${item.quantity} ${item.unit} remaining`,
      actionUrl: "/operations#inventory",
    })),
  );
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "homeId is required" } },
        { status: 400 },
      );
    }
    await requireHomeAccess(homeId);

    const [
      taskRows,
      templateRows,
      recordRows,
      repairRows,
      providerRows,
      inventoryRows,
      replacementRows,
      budgetRows,
      projectRows,
      insuranceRows,
      assetRows,
      roomRows,
      documentRows,
    ] = await Promise.all([
      db
        .select()
        .from(maintenanceTasks)
        .where(and(eq(maintenanceTasks.homeId, homeId), isNull(maintenanceTasks.archivedAt)))
        .orderBy(asc(maintenanceTasks.nextDueAt)),
      db
        .select()
        .from(maintenanceTemplates)
        .where(
          and(
            eq(maintenanceTemplates.homeId, homeId),
            isNull(maintenanceTemplates.archivedAt),
          ),
        )
        .orderBy(asc(maintenanceTemplates.title)),
      db
        .select()
        .from(maintenanceRecords)
        .where(eq(maintenanceRecords.homeId, homeId))
        .orderBy(desc(maintenanceRecords.completedAt))
        .limit(500),
      db
        .select()
        .from(repairRecords)
        .where(
          and(
            eq(repairRecords.homeId, homeId),
            sql`"repair_records"."archived_at" is null`,
          ),
        )
        .orderBy(desc(repairRecords.createdAt))
        .limit(500),
      db
        .select()
        .from(serviceProviders)
        .where(and(eq(serviceProviders.homeId, homeId), isNull(serviceProviders.archivedAt)))
        .orderBy(asc(serviceProviders.name)),
      db
        .select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.homeId, homeId), isNull(inventoryItems.archivedAt)))
        .orderBy(asc(inventoryItems.name)),
      db
        .select()
        .from(assetReplacementLinks)
        .where(eq(assetReplacementLinks.homeId, homeId))
        .orderBy(desc(assetReplacementLinks.replacedAt)),
      db
        .select()
        .from(homeBudgets)
        .where(eq(homeBudgets.homeId, homeId))
        .orderBy(desc(homeBudgets.year)),
      db
        .select()
        .from(renovationProjects)
        .where(
          and(
            eq(renovationProjects.homeId, homeId),
            isNull(renovationProjects.archivedAt),
          ),
        )
        .orderBy(desc(renovationProjects.createdAt)),
      db
        .select()
        .from(insuranceItems)
        .where(eq(insuranceItems.homeId, homeId))
        .orderBy(asc(insuranceItems.category), asc(insuranceItems.name)),
      db
        .select()
        .from(assets)
        .where(and(eq(assets.homeId, homeId), isNull(assets.archivedAt)))
        .orderBy(asc(assets.name)),
      db.select().from(rooms).where(eq(rooms.homeId, homeId)).orderBy(asc(rooms.name)),
      db
        .select({
          id: documents.id,
          title: documents.title,
          type: documents.type,
          assetId: documents.assetId,
        })
        .from(documents)
        .where(
          and(eq(documents.homeId, homeId), sql`"documents"."archived_at" is null`),
        )
        .orderBy(desc(documents.createdAt))
        .limit(200),
    ]);

    const taskIds = taskRows.map((task) => task.id);
    const templateIds = templateRows.map((template) => template.id);
    const providerIds = providerRows.map((provider) => provider.id);
    const inventoryIds = inventoryRows.map((item) => item.id);
    const projectIds = projectRows.map((project) => project.id);

    const [
      taskChecklistRows,
      templateChecklistRows,
      recurrenceRows,
      scheduleRows,
      interventionRows,
      movementRows,
      renovationTaskRows,
      quoteRows,
      renovationDocumentRows,
    ] = await Promise.all([
      taskIds.length
        ? db
            .select()
            .from(maintenanceTaskChecklistItems)
            .where(inArray(maintenanceTaskChecklistItems.taskId, taskIds))
            .orderBy(asc(maintenanceTaskChecklistItems.sortOrder))
        : [],
      templateIds.length
        ? db
            .select()
            .from(maintenanceTemplateChecklistItems)
            .where(inArray(maintenanceTemplateChecklistItems.templateId, templateIds))
            .orderBy(asc(maintenanceTemplateChecklistItems.sortOrder))
        : [],
      db
        .select()
        .from(maintenanceRecurrenceRules)
        .where(
          taskIds.length && templateIds.length
            ? sql`${maintenanceRecurrenceRules.taskId} in ${taskIds} or ${maintenanceRecurrenceRules.templateId} in ${templateIds}`
            : taskIds.length
              ? inArray(maintenanceRecurrenceRules.taskId, taskIds)
              : templateIds.length
                ? inArray(maintenanceRecurrenceRules.templateId, templateIds)
                : sql`false`,
        ),
      taskIds.length
        ? db
            .select()
            .from(maintenanceScheduleEvents)
            .where(inArray(maintenanceScheduleEvents.taskId, taskIds))
            .orderBy(desc(maintenanceScheduleEvents.createdAt))
            .limit(200)
        : [],
      providerIds.length
        ? db
            .select()
            .from(providerInterventions)
            .where(inArray(providerInterventions.providerId, providerIds))
            .orderBy(desc(providerInterventions.occurredAt))
            .limit(300)
        : [],
      inventoryIds.length
        ? db
            .select()
            .from(inventoryMovements)
            .where(inArray(inventoryMovements.itemId, inventoryIds))
            .orderBy(desc(inventoryMovements.createdAt))
            .limit(300)
        : [],
      projectIds.length
        ? db
            .select()
            .from(renovationTasks)
            .where(inArray(renovationTasks.projectId, projectIds))
            .orderBy(asc(renovationTasks.sortOrder))
        : [],
      projectIds.length
        ? db
            .select()
            .from(renovationQuotes)
            .where(inArray(renovationQuotes.projectId, projectIds))
            .orderBy(desc(renovationQuotes.createdAt))
        : [],
      projectIds.length
        ? db
            .select()
            .from(renovationDocuments)
            .where(inArray(renovationDocuments.projectId, projectIds))
        : [],
    ]);

    const checklistByTask = new Map<string, typeof taskChecklistRows>();
    for (const item of taskChecklistRows) {
      const current = checklistByTask.get(item.taskId) ?? [];
      current.push(item);
      checklistByTask.set(item.taskId, current);
    }
    const checklistByTemplate = new Map<string, typeof templateChecklistRows>();
    for (const item of templateChecklistRows) {
      const current = checklistByTemplate.get(item.templateId) ?? [];
      current.push(item);
      checklistByTemplate.set(item.templateId, current);
    }
    const recurrenceByTask = new Map(
      recurrenceRows
        .filter((rule) => rule.taskId)
        .map((rule) => [rule.taskId!, rule.rule]),
    );
    const recurrenceByTemplate = new Map(
      recurrenceRows
        .filter((rule) => rule.templateId)
        .map((rule) => [rule.templateId!, rule.rule]),
    );

    const actuals = new Map<number, { maintenance: number; repairs: number }>();
    for (const record of recordRows) {
      const year = record.completedAt.getUTCFullYear();
      const current = actuals.get(year) ?? { maintenance: 0, repairs: 0 };
      current.maintenance += Number(record.cost ?? 0);
      actuals.set(year, current);
    }
    for (const repair of repairRows) {
      const year = Number(repair.repairDate?.slice(0, 4) ?? repair.issueDate.slice(0, 4));
      const current = actuals.get(year) ?? { maintenance: 0, repairs: 0 };
      current.repairs += Number(repair.cost ?? 0);
      actuals.set(year, current);
    }

    const replacementForecast = new Map<number, number>();
    for (const asset of assetRows) {
      if (!asset.expectedLifetimeYears) continue;
      const installed = asset.installationDate ?? asset.purchaseDate;
      if (!installed) continue;
      const year = Number(installed.slice(0, 4)) + asset.expectedLifetimeYears;
      replacementForecast.set(
        year,
        (replacementForecast.get(year) ?? 0) + Number(asset.purchasePrice ?? 0),
      );
    }

    const budgetComparison = budgetRows.map((budget) => {
      const actual = actuals.get(budget.year) ?? { maintenance: 0, repairs: 0 };
      return {
        ...budget,
        actualMaintenance: actual.maintenance,
        actualRepairs: actual.repairs,
        forecastReplacement: replacementForecast.get(budget.year) ?? 0,
      };
    });

    const insuranceTotals = Object.values(
      insuranceRows.reduce<Record<string, { currency: string; total: number }>>(
        (totals, item) => {
          const current = totals[item.currency] ?? { currency: item.currency, total: 0 };
          current.total += Number(item.unitValue) * item.quantity;
          totals[item.currency] = current;
          return totals;
        },
        {},
      ),
    );

    return Response.json({
      tasks: taskRows.map((task) => ({
        ...task,
        checklist: checklistByTask.get(task.id) ?? [],
        recurrenceRule: recurrenceByTask.get(task.id) ?? null,
      })),
      templates: templateRows.map((template) => ({
        ...template,
        checklist: checklistByTemplate.get(template.id) ?? [],
        recurrenceRule: recurrenceByTemplate.get(template.id) ?? null,
      })),
      scheduleHistory: scheduleRows,
      maintenanceRecords: recordRows,
      repairs: repairRows,
      providers: providerRows,
      providerInterventions: interventionRows,
      inventory: inventoryRows,
      inventoryMovements: movementRows,
      replacements: replacementRows,
      budgets: budgetComparison,
      replacementForecast: [...replacementForecast.entries()].map(([year, amount]) => ({
        year,
        amount,
      })),
      renovations: projectRows,
      renovationTasks: renovationTaskRows,
      renovationQuotes: quoteRows,
      renovationDocuments: renovationDocumentRows,
      insuranceItems: insuranceRows,
      insuranceTotals,
      assets: assetRows,
      rooms: roomRows,
      documents: documentRows,
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const action = z.string().parse(raw.action);
    const homeId = homeInput.parse(raw).homeId;

    if (action === "checklist.add") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          targetType: z.enum(["TASK", "TEMPLATE"]),
          targetId: z.string().uuid(),
          title: z.string().trim().min(1).max(240),
          required: z.boolean().default(true),
        })
        .parse(raw);
      await requireHomeRole(homeId, ["OWNER", "ADMIN", "MEMBER"]);
      if (input.targetType === "TASK") {
        await taskInHome(input.targetId, homeId);
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(maintenanceTaskChecklistItems)
          .where(eq(maintenanceTaskChecklistItems.taskId, input.targetId));
        const [item] = await db
          .insert(maintenanceTaskChecklistItems)
          .values({
            taskId: input.targetId,
            title: input.title,
            required: input.required,
            sortOrder: count ?? 0,
          })
          .returning();
        return Response.json({ item, requestId: id }, { status: 201 });
      }
      await templateInHome(input.targetId, homeId);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenanceTemplateChecklistItems)
        .where(eq(maintenanceTemplateChecklistItems.templateId, input.targetId));
      const [item] = await db
        .insert(maintenanceTemplateChecklistItems)
        .values({
          templateId: input.targetId,
          title: input.title,
          required: input.required,
          sortOrder: count ?? 0,
        })
        .returning();
      return Response.json({ item, requestId: id }, { status: 201 });
    }

    if (action === "checklist.toggle") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          itemId: z.string().uuid(),
          completed: z.boolean(),
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);
      const [item] = await db
        .select({ item: maintenanceTaskChecklistItems, taskHomeId: maintenanceTasks.homeId })
        .from(maintenanceTaskChecklistItems)
        .innerJoin(
          maintenanceTasks,
          eq(maintenanceTasks.id, maintenanceTaskChecklistItems.taskId),
        )
        .where(eq(maintenanceTaskChecklistItems.id, input.itemId))
        .limit(1);
      if (!item || item.taskHomeId !== homeId)
        throw new AppError("NOT_FOUND", "Checklist item not found.", 404);
      const [updated] = await db
        .update(maintenanceTaskChecklistItems)
        .set({
          completedAt: input.completed ? new Date() : null,
          completedBy: input.completed ? session.user.id : null,
          updatedAt: new Date(),
        })
        .where(eq(maintenanceTaskChecklistItems.id, input.itemId))
        .returning();
      return Response.json({ item: updated, requestId: id });
    }

    if (action === "checklist.delete") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          targetType: z.enum(["TASK", "TEMPLATE"]),
          itemId: z.string().uuid(),
        })
        .parse(raw);
      await requireHomeRole(homeId, ["OWNER", "ADMIN", "MEMBER"]);
      if (input.targetType === "TASK") {
        const [row] = await db
          .select({ taskId: maintenanceTaskChecklistItems.taskId })
          .from(maintenanceTaskChecklistItems)
          .where(eq(maintenanceTaskChecklistItems.id, input.itemId))
          .limit(1);
        if (!row) throw new AppError("NOT_FOUND", "Checklist item not found.", 404);
        await taskInHome(row.taskId, homeId);
        await db
          .delete(maintenanceTaskChecklistItems)
          .where(eq(maintenanceTaskChecklistItems.id, input.itemId));
      } else {
        const [row] = await db
          .select({ templateId: maintenanceTemplateChecklistItems.templateId })
          .from(maintenanceTemplateChecklistItems)
          .where(eq(maintenanceTemplateChecklistItems.id, input.itemId))
          .limit(1);
        if (!row) throw new AppError("NOT_FOUND", "Checklist item not found.", 404);
        await templateInHome(row.templateId, homeId);
        await db
          .delete(maintenanceTemplateChecklistItems)
          .where(eq(maintenanceTemplateChecklistItems.id, input.itemId));
      }
      return Response.json({ success: true, requestId: id });
    }

    if (action === "schedule.change") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          taskId: z.string().uuid(),
          scheduleAction: z.enum(["POSTPONE", "SNOOZE", "RESCHEDULE"]),
          newDueAt: z.coerce.date(),
          reason: z.string().trim().min(3).max(1000),
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);
      const task = await taskInHome(input.taskId, homeId);
      if (input.newDueAt.getTime() <= Date.now()) {
        throw new AppError(
          "VALIDATION_ERROR",
          "The new due date must be in the future.",
          400,
        );
      }
      const result = await db.transaction(async (tx) => {
        const [event] = await tx
          .insert(maintenanceScheduleEvents)
          .values({
            taskId: task.id,
            homeId,
            action: input.scheduleAction,
            previousDueAt: task.nextDueAt,
            newDueAt: input.newDueAt,
            reason: input.reason,
            createdBy: session.user.id,
          })
          .returning();
        const [updated] = await tx
          .update(maintenanceTasks)
          .set({ nextDueAt: input.newDueAt, updatedAt: new Date() })
          .where(eq(maintenanceTasks.id, task.id))
          .returning();
        return { event, task: updated };
      });
      return Response.json({ ...result, requestId: id });
    }

    if (action === "recurrence.upsert") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          targetType: z.enum(["TASK", "TEMPLATE"]),
          targetId: z.string().uuid(),
          rule: z.object({
            weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
            months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
            dayOfMonth: z.number().int().min(1).max(31).optional(),
            season: z.enum(["SPRING", "SUMMER", "AUTUMN", "WINTER"]).optional(),
            startDate: z.string().date().optional(),
            endDate: z.string().date().optional(),
            custom: z
              .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
              .optional(),
          }),
        })
        .parse(raw);
      await requireHomeRole(homeId, ["OWNER", "ADMIN"]);
      if (input.targetType === "TASK") {
        await taskInHome(input.targetId, homeId);
        const [rule] = await db
          .insert(maintenanceRecurrenceRules)
          .values({ taskId: input.targetId, rule: input.rule })
          .onConflictDoUpdate({
            target: maintenanceRecurrenceRules.taskId,
            set: { rule: input.rule, updatedAt: new Date() },
          })
          .returning();
        return Response.json({ rule, requestId: id });
      }
      await templateInHome(input.targetId, homeId);
      const [rule] = await db
        .insert(maintenanceRecurrenceRules)
        .values({ templateId: input.targetId, rule: input.rule })
        .onConflictDoUpdate({
          target: maintenanceRecurrenceRules.templateId,
          set: { rule: input.rule, updatedAt: new Date() },
        })
        .returning();
      return Response.json({ rule, requestId: id });
    }

    if (action === "provider.create" || action === "provider.update") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          providerId: z.string().uuid().optional(),
          name: z.string().trim().min(1).max(160),
          company: z.string().trim().max(160).optional().nullable(),
          email: z.string().email().optional().nullable(),
          phone: z.string().trim().max(80).optional().nullable(),
          website: z.string().url().optional().nullable(),
          specialties: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
          notes: z.string().trim().max(3000).optional().nullable(),
          rating: z.number().int().min(1).max(5).optional().nullable(),
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);
      if (action === "provider.update") {
        if (!input.providerId)
          throw new AppError("VALIDATION_ERROR", "providerId is required", 400);
        await providerInHome(input.providerId, homeId);
        const [provider] = await db
          .update(serviceProviders)
          .set({
            name: input.name,
            company: input.company,
            email: input.email,
            phone: input.phone,
            website: input.website,
            specialties: input.specialties,
            notes: input.notes,
            rating: input.rating,
            updatedAt: new Date(),
          })
          .where(eq(serviceProviders.id, input.providerId))
          .returning();
        return Response.json({ provider, requestId: id });
      }
      const [provider] = await db
        .insert(serviceProviders)
        .values({
          homeId,
          name: input.name,
          company: input.company,
          email: input.email,
          phone: input.phone,
          website: input.website,
          specialties: input.specialties,
          notes: input.notes,
          rating: input.rating,
          createdBy: session.user.id,
        })
        .returning();
      return Response.json({ provider, requestId: id }, { status: 201 });
    }

    if (action === "provider.intervention") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          providerId: z.string().uuid(),
          maintenanceRecordId: optionalUuid,
          repairId: optionalUuid,
          renovationProjectId: optionalUuid,
          occurredAt: z.string().date(),
          notes: z.string().trim().max(3000).optional().nullable(),
          rating: z.number().int().min(1).max(5).optional().nullable(),
          cost: money.optional().nullable(),
          currency: z.string().length(3).default("EUR"),
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);
      await providerInHome(input.providerId, homeId);
      if (input.maintenanceRecordId) {
        const [record] = await db
          .select({ homeId: maintenanceRecords.homeId })
          .from(maintenanceRecords)
          .where(eq(maintenanceRecords.id, input.maintenanceRecordId))
          .limit(1);
        if (!record || record.homeId !== homeId)
          throw new AppError("NOT_FOUND", "Maintenance record not found.", 404);
      }
      if (input.repairId) {
        const [repair] = await db
          .select({ homeId: repairRecords.homeId })
          .from(repairRecords)
          .where(eq(repairRecords.id, input.repairId))
          .limit(1);
        if (!repair || repair.homeId !== homeId)
          throw new AppError("NOT_FOUND", "Repair not found.", 404);
      }
      if (input.renovationProjectId)
        await projectInHome(input.renovationProjectId, homeId);
      const [intervention] = await db
        .insert(providerInterventions)
        .values({
          ...input,
          cost: input.cost ?? null,
          createdBy: session.user.id,
        })
        .returning();
      return Response.json({ intervention, requestId: id }, { status: 201 });
    }

    if (action === "inventory.create" || action === "inventory.update") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          itemId: z.string().uuid().optional(),
          assetId: optionalUuid,
          name: z.string().trim().min(1).max(160),
          sku: z.string().trim().max(120).optional().nullable(),
          quantity: z.number().int().min(0).max(1_000_000),
          unit: z.string().trim().min(1).max(40).default("piece"),
          reorderThreshold: z.number().int().min(0).max(1_000_000).default(0),
          location: z.string().trim().max(160).optional().nullable(),
          unitCost: money.optional().nullable(),
          currency: z.string().length(3).default("EUR"),
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);
      if (input.assetId) await requireAssetInHome(input.assetId, homeId);
      if (action === "inventory.update") {
        if (!input.itemId)
          throw new AppError("VALIDATION_ERROR", "itemId is required", 400);
        const [existing] = await db
          .select()
          .from(inventoryItems)
          .where(and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.homeId, homeId)))
          .limit(1);
        if (!existing) throw new AppError("NOT_FOUND", "Inventory item not found.", 404);
        const [item] = await db
          .update(inventoryItems)
          .set({
            assetId: input.assetId,
            name: input.name,
            sku: input.sku,
            quantity: input.quantity,
            unit: input.unit,
            reorderThreshold: input.reorderThreshold,
            location: input.location,
            unitCost: input.unitCost,
            currency: input.currency,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, input.itemId))
          .returning();
        if (item) await notifyLowStock(homeId, item);
        return Response.json({ item, requestId: id });
      }
      const [item] = await db
        .insert(inventoryItems)
        .values({
          homeId,
          assetId: input.assetId,
          name: input.name,
          sku: input.sku,
          quantity: input.quantity,
          unit: input.unit,
          reorderThreshold: input.reorderThreshold,
          location: input.location,
          unitCost: input.unitCost,
          currency: input.currency,
          createdBy: session.user.id,
        })
        .returning();
      if (item) {
        await db.insert(inventoryMovements).values({
          itemId: item.id,
          delta: item.quantity,
          reason: "Initial stock",
          createdBy: session.user.id,
        });
        await notifyLowStock(homeId, item);
      }
      return Response.json({ item, requestId: id }, { status: 201 });
    }

    if (action === "inventory.adjust") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          itemId: z.string().uuid(),
          delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
          reason: z.string().trim().min(2).max(500),
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);
      const item = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(inventoryItems)
          .where(and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.homeId, homeId)))
          .for("update")
          .limit(1);
        if (!current) throw new AppError("NOT_FOUND", "Inventory item not found.", 404);
        const quantity = current.quantity + input.delta;
        if (quantity < 0)
          throw new AppError("CONFLICT", "Stock cannot become negative.", 409);
        const [updated] = await tx
          .update(inventoryItems)
          .set({ quantity, updatedAt: new Date() })
          .where(eq(inventoryItems.id, current.id))
          .returning();
        await tx.insert(inventoryMovements).values({
          itemId: current.id,
          delta: input.delta,
          reason: input.reason,
          createdBy: session.user.id,
        });
        return updated;
      });
      if (item) await notifyLowStock(homeId, item);
      return Response.json({ item, requestId: id });
    }

    if (action === "replacement.link") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          predecessorAssetId: z.string().uuid(),
          successorAssetId: z.string().uuid(),
          replacedAt: z.string().date(),
          notes: z.string().trim().max(2000).optional().nullable(),
        })
        .refine((value) => value.predecessorAssetId !== value.successorAssetId, {
          message: "An asset cannot replace itself.",
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, ["OWNER", "ADMIN"]);
      await Promise.all([
        requireAssetInHome(input.predecessorAssetId, homeId),
        requireAssetInHome(input.successorAssetId, homeId),
      ]);
      const replacement = await db.transaction(async (tx) => {
        const [link] = await tx
          .insert(assetReplacementLinks)
          .values({ ...input, createdBy: session.user.id })
          .returning();
        await tx
          .update(assets)
          .set({ status: "REPLACED", updatedAt: new Date() })
          .where(eq(assets.id, input.predecessorAssetId));
        return link;
      });
      return Response.json({ replacement, requestId: id }, { status: 201 });
    }

    if (action === "budget.upsert") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          year: z.number().int().min(2000).max(2200),
          currency: z.string().length(3).default("EUR"),
          maintenanceBudget: money,
          repairBudget: money,
          replacementBudget: money,
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, ["OWNER", "ADMIN"]);
      const [budget] = await db
        .insert(homeBudgets)
        .values({ ...input, createdBy: session.user.id })
        .onConflictDoUpdate({
          target: [homeBudgets.homeId, homeBudgets.year],
          set: {
            currency: input.currency,
            maintenanceBudget: input.maintenanceBudget,
            repairBudget: input.repairBudget,
            replacementBudget: input.replacementBudget,
            updatedAt: new Date(),
          },
        })
        .returning();
      return Response.json({ budget, requestId: id });
    }

    if (action === "renovation.create") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          name: z.string().trim().min(1).max(160),
          description: z.string().trim().max(4000).optional().nullable(),
          status: z.enum(["PLANNING", "QUOTING", "IN_PROGRESS", "PAUSED", "COMPLETED"]),
          startDate: z.string().date().optional().nullable(),
          targetEndDate: z.string().date().optional().nullable(),
          budget: money.optional().nullable(),
          currency: z.string().length(3).default("EUR"),
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);
      const [project] = await db
        .insert(renovationProjects)
        .values({ ...input, createdBy: session.user.id })
        .returning();
      return Response.json({ project, requestId: id }, { status: 201 });
    }

    if (action === "renovation.task") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          projectId: z.string().uuid(),
          title: z.string().trim().min(1).max(240),
          dueDate: z.string().date().optional().nullable(),
          assignedTo: optionalUuid,
        })
        .parse(raw);
      await requireHomeRole(homeId, ["OWNER", "ADMIN", "MEMBER"]);
      await projectInHome(input.projectId, homeId);
      if (input.assignedTo) await requireMemberInHome(input.assignedTo, homeId);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(renovationTasks)
        .where(eq(renovationTasks.projectId, input.projectId));
      const [task] = await db
        .insert(renovationTasks)
        .values({ ...input, sortOrder: count ?? 0 })
        .returning();
      return Response.json({ task, requestId: id }, { status: 201 });
    }

    if (action === "renovation.task.toggle") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          taskId: z.string().uuid(),
          completed: z.boolean(),
        })
        .parse(raw);
      await requireHomeRole(homeId, ["OWNER", "ADMIN", "MEMBER"]);
      const [existing] = await db
        .select({ projectId: renovationTasks.projectId })
        .from(renovationTasks)
        .where(eq(renovationTasks.id, input.taskId))
        .limit(1);
      if (!existing) throw new AppError("NOT_FOUND", "Project task not found.", 404);
      await projectInHome(existing.projectId, homeId);
      const [task] = await db
        .update(renovationTasks)
        .set({ completedAt: input.completed ? new Date() : null, updatedAt: new Date() })
        .where(eq(renovationTasks.id, input.taskId))
        .returning();
      return Response.json({ task, requestId: id });
    }

    if (action === "renovation.quote") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          projectId: z.string().uuid(),
          providerId: optionalUuid,
          description: z.string().trim().min(1).max(1000),
          amount: money,
          currency: z.string().length(3).default("EUR"),
          status: z.enum(["RECEIVED", "SHORTLISTED", "ACCEPTED", "REJECTED"]),
          documentId: optionalUuid,
        })
        .parse(raw);
      await requireHomeRole(homeId, ["OWNER", "ADMIN", "MEMBER"]);
      await projectInHome(input.projectId, homeId);
      if (input.providerId) await providerInHome(input.providerId, homeId);
      if (input.documentId) await requireDocumentInHome(input.documentId, homeId);
      const [quote] = await db.insert(renovationQuotes).values(input).returning();
      return Response.json({ quote, requestId: id }, { status: 201 });
    }

    if (action === "insurance.create") {
      const input = z
        .object({
          homeId: z.string().uuid(),
          roomId: optionalUuid,
          assetId: optionalUuid,
          documentId: optionalUuid,
          name: z.string().trim().min(1).max(160),
          category: z.string().trim().min(1).max(120),
          quantity: z.number().int().min(1).max(1_000_000).default(1),
          unitValue: money,
          currency: z.string().length(3).default("EUR"),
          purchaseDate: z.string().date().optional().nullable(),
          notes: z.string().trim().max(3000).optional().nullable(),
        })
        .parse(raw);
      const { session } = await requireHomeRole(homeId, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);
      if (input.roomId) await requireRoomInHome(input.roomId, homeId);
      if (input.assetId) await requireAssetInHome(input.assetId, homeId);
      if (input.documentId) await requireDocumentInHome(input.documentId, homeId);
      const [item] = await db
        .insert(insuranceItems)
        .values({ ...input, createdBy: session.user.id })
        .returning();
      return Response.json({ item, requestId: id }, { status: 201 });
    }

    if (action === "insurance.delete") {
      const input = z
        .object({ homeId: z.string().uuid(), itemId: z.string().uuid() })
        .parse(raw);
      await requireHomeRole(homeId, ["OWNER", "ADMIN", "MEMBER"]);
      const [item] = await db
        .select({ homeId: insuranceItems.homeId })
        .from(insuranceItems)
        .where(eq(insuranceItems.id, input.itemId))
        .limit(1);
      if (!item || item.homeId !== homeId)
        throw new AppError("NOT_FOUND", "Insurance item not found.", 404);
      await db.delete(insuranceItems).where(eq(insuranceItems.id, input.itemId));
      return Response.json({ success: true, requestId: id });
    }

    throw new AppError("VALIDATION_ERROR", `Unknown operation: ${action}`, 400);
  } catch (error) {
    return errorResponse(error, id);
  }
}
