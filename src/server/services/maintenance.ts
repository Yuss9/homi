import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db";
import {
  maintenanceRecords,
  maintenanceTasks,
  notifications,
} from "../../../db/schema";
import {
  calculateNextDueDate,
  isDue,
} from "../../features/maintenance/recurrence";
import { AppError } from "../errors";

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
});

export async function createMaintenanceTask(userId: string, raw: unknown) {
  const input = taskInput.parse(raw);
  const [task] = await db
    .insert(maintenanceTasks)
    .values({ ...input, createdBy: userId })
    .returning();
  if (task?.assignedTo && task.assignedTo !== userId) {
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

    const nextDueAt = calculateNextDueDate(
      input.completedAt,
      task.frequencyType,
      task.frequencyInterval,
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
    return { record, nextDueAt, replayed: false };
  });
}
