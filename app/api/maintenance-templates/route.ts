import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceTemplates } from "@/db/high-value-schema";
import {
  maintenanceRecurrenceRules,
  maintenanceTemplateChecklistItems,
} from "@/db/maintenance-operations-schema";
import { systemMaintenanceTemplates } from "@/src/features/maintenance/templates";
import { requireHomeAccess, requireHomeRole } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const recurrenceRule = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  season: z.enum(["SPRING", "SUMMER", "AUTUMN", "WINTER"]).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  custom: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

const templateInput = z.object({
  homeId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1).max(80),
  frequencyType: z.enum([
    "ONCE",
    "DAILY",
    "WEEKLY",
    "MONTHLY",
    "YEARLY",
    "CUSTOM",
  ]),
  frequencyInterval: z.number().int().min(1).max(3650).default(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  checklist: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(240),
        required: z.boolean().default(true),
      }),
    )
    .max(50)
    .default([]),
  recurrenceRule: recurrenceRule.optional(),
});

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
    const custom = await db
      .select()
      .from(maintenanceTemplates)
      .where(
        and(
          eq(maintenanceTemplates.homeId, homeId),
          isNull(maintenanceTemplates.archivedAt),
        ),
      )
      .orderBy(asc(maintenanceTemplates.category), asc(maintenanceTemplates.title));
    const ids = custom.map((template) => template.id);
    const [checklistRows, recurrenceRows] = await Promise.all([
      ids.length
        ? db
            .select()
            .from(maintenanceTemplateChecklistItems)
            .where(inArray(maintenanceTemplateChecklistItems.templateId, ids))
            .orderBy(asc(maintenanceTemplateChecklistItems.sortOrder))
        : [],
      ids.length
        ? db
            .select()
            .from(maintenanceRecurrenceRules)
            .where(inArray(maintenanceRecurrenceRules.templateId, ids))
        : [],
    ]);
    const checklistByTemplate = new Map<string, typeof checklistRows>();
    for (const item of checklistRows) {
      const current = checklistByTemplate.get(item.templateId) ?? [];
      current.push(item);
      checklistByTemplate.set(item.templateId, current);
    }
    const recurrenceByTemplate = new Map(
      recurrenceRows
        .filter((row) => row.templateId)
        .map((row) => [row.templateId!, row.rule]),
    );

    return Response.json({
      templates: [
        ...systemMaintenanceTemplates.map((template) => ({
          ...template,
          checklist: [],
          recurrenceRule: null,
        })),
        ...custom.map((template) => ({
          ...template,
          source: "HOME" as const,
          checklist: checklistByTemplate.get(template.id) ?? [],
          recurrenceRule: recurrenceByTemplate.get(template.id) ?? null,
        })),
      ],
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = templateInput.parse(await request.json());
    const { session } = await requireHomeRole(body.homeId, ["OWNER", "ADMIN"]);
    const { checklist, recurrenceRule: advancedRule, ...templateValues } = body;
    const template = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(maintenanceTemplates)
        .values({
          ...templateValues,
          description: templateValues.description || null,
          estimatedDurationMinutes:
            templateValues.estimatedDurationMinutes ?? null,
          createdBy: session.user.id,
        })
        .returning();
      if (!created) throw new Error("Could not create maintenance template.");
      if (checklist.length) {
        await tx.insert(maintenanceTemplateChecklistItems).values(
          checklist.map((item, sortOrder) => ({
            templateId: created.id,
            title: item.title,
            required: item.required,
            sortOrder,
          })),
        );
      }
      if (advancedRule && Object.keys(advancedRule).length) {
        await tx.insert(maintenanceRecurrenceRules).values({
          templateId: created.id,
          rule: advancedRule,
        });
      }
      return created;
    });
    return Response.json(
      { template: { ...template, source: "HOME" as const }, requestId: id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
