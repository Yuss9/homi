import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db";
import {
  maintenanceRecurrenceRules,
  maintenanceTaskChecklistItems,
} from "../../../db/maintenance-operations-schema";
import {
  maintenanceRecords,
  maintenanceTasks,
  notifications,
} from "../../../db/schema";
import { calculateAdvancedNextDueDate } from "../../features/maintenance/advanced-recurrence";
import { isDue } from "../../features/maintenance/recurrence";
import { requireAssetInHome, requireMemberInHome } from "../authorization";
import { AppError } from "../errors";

const recurrenceRuleInput = z
  .object({
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    season: z.enum(["SPRING", "SUMMER", "AUTUMN", "WINTER"]).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    custom: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The recurrence end date must be after its start date.",
      });
    }
  });

export const taskInput = z.object({
  homeId: z.string().uuid(),
  assetId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  frequencyType: z.enum([
    "ONCE",
    "DAILY",
    "WEEKLY",
    "MONTHLY",
    "YEARLY",
    "CUSTOM",
  ]),
  frequencyInterval: z.number().int().min(1).max(3650).default(1),
  nextDueAt: z.coerce.date(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  checklist: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(240),
        required: z.boolean().default(true),
      }),
    )
    .max(50)
    .default([]),
  recurrenceRule: recurrenceRuleInput.optional(),
});

export async function createMaintenanceTask(userId: string, raw: unknown) {
  const input = taskInput.parse(raw);
  if (input.assetId) await requireAssetInHome(input.assetId, input.homeId);
  if (input.assignedTo) await requireMemberInHome(input.assignedTo, input.homeId);
  const { checklist, recurrenceRule, ...taskValues } = input;
  const task = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(maintenanceTasks)
      .values({ ...taskValues, createdBy: userId })
      .returning();
    if (!created) throw new Error("Could not create maintenance task.");
    if (checklist.length) {
      await tx.insert(maintenanceTaskChecklistItems).values(
        checklist.map((item, sortOrder) => ({
          taskId: created.id,
          title: item.title,
          required: item.required,
          sortOrder,
        })),
      );
    }
    if (recurrenceRule && Object.keys(recurrenceRule).length) {
      await tx.insert(maintenanceRecurrenceRules).values({
        taskId: created.id,
        rule: recurrenceRule,
      });
    }
    return created;
  });
  if (task.assignedTo && task.assignedTo !== userId) {
    await db.insert(notifications).values({
      userId: task.assignedTo,
      homeId: task.homeId,
      type: "TASK_ASSIGNED",
      title: "A task was assigned to you",
      message: task.title,
      actionUrl: `/maintenance/${task.id}`,
    });
  }
  return task;
}

export const completeTaskInput = z.object({
  taskId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  completedAt: z.coerce.date().default(() => new Date()),
  notes: z.string().trim().max(4000).optional(),
  cost: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/)
    .optional(),
  currency: z.string().length(3).default("EUR"),
  serviceProvider: z.string().trim().max(160).optional(),
});

export async function completeMaintenanceTask(userId: string, raw: unknown) {
  const input = completeTaskInput.parse(raw);
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing[0]) return { record: existing[0], replayed: true };

    const [task] = await tx
      .select()
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.id, input.taskId),
          isNull(maintenanceTasks.archivedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!task)
      throw new AppError("NOT_FOUND", "Maintenance task not found.", 404);
    if (!isDue(task.nextDueAt)) {
      throw new AppError(
        "CONFLICT",
        `This task can be completed on or after ${new Intl.DateTimeFormat(
          "en",
          { dateStyle: "medium", timeZone: "UTC" },
        ).format(task.nextDueAt)}.`,
        409,
      );
    }

    const [incompleteRequiredItem] = await tx
      .select({ id: maintenanceTaskChecklistItems.id })
      .from(maintenanceTaskChecklistItems)
      .where(
        and(
          eq(maintenanceTaskChecklistItems.taskId, task.id),
          eq(maintenanceTaskChecklistItems.required, true),
          isNull(maintenanceTaskChecklistItems.completedAt),
        ),
      )
      .limit(1);
    if (incompleteRequiredItem) {
      throw new AppError(
        "CONFLICT",
        "Complete every required checklist item before finishing this maintenance.",
        409,
      );
    }

    const [recurrence] = await tx
      .select({ rule: maintenanceRecurrenceRules.rule })
      .from(maintenanceRecurrenceRules)
      .where(eq(maintenanceRecurrenceRules.taskId, task.id))
      .limit(1);
    const nextDueAt = calculateAdvancedNextDueDate(
      input.completedAt,
      task.frequencyType,
      task.frequencyInterval,
      recurrence?.rule,
    );
    const [record] = await tx
      .insert(maintenanceRecords)
      .values({
        idempotencyKey: input.idempotencyKey,
        taskId: task.id,
        assetId: task.assetId,
        homeId: task.homeId,
        completedBy: userId,
        completedAt: input.completedAt,
        notes: input.notes,
        cost: input.cost,
        currency: input.currency,
        serviceProvider: input.serviceProvider,
      })
      .returning();
    await tx
      .update(maintenanceTasks)
      .set({
        lastCompletedAt: input.completedAt,
        nextDueAt: nextDueAt ?? input.completedAt,
        archivedAt: nextDueAt ? null : input.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceTasks.id, task.id));
    if (nextDueAt) {
      await tx
        .update(maintenanceTaskChecklistItems)
        .set({ completedAt: null, completedBy: null, updatedAt: new Date() })
        .where(eq(maintenanceTaskChecklistItems.taskId, task.id));
    }
    return { record, nextDueAt, replayed: false };
  });
}
