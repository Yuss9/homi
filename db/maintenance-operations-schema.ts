import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { maintenanceTemplates } from "./high-value-schema";
import {
  assets,
  documents,
  homes,
  maintenanceRecords,
  maintenanceTasks,
  repairRecords,
  rooms,
  user,
} from "./schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export type AdvancedRecurrenceRule = {
  weekdays?: number[];
  months?: number[];
  dayOfMonth?: number;
  season?: "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
  startDate?: string;
  endDate?: string;
  custom?: Record<string, string | number | boolean>;
};

export const maintenanceTemplateChecklistItems = pgTable(
  "maintenance_template_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => maintenanceTemplates.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    required: boolean("required").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [index("template_checklist_template_idx").on(table.templateId, table.sortOrder)],
);

export const maintenanceTaskChecklistItems = pgTable(
  "maintenance_task_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => maintenanceTasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    required: boolean("required").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("task_checklist_task_idx").on(table.taskId, table.sortOrder),
    index("task_checklist_completion_idx").on(table.taskId, table.completedAt),
  ],
);

export const maintenanceScheduleEvents = pgTable(
  "maintenance_schedule_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => maintenanceTasks.id, { onDelete: "cascade" }),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    previousDueAt: timestamp("previous_due_at", { withTimezone: true }).notNull(),
    newDueAt: timestamp("new_due_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("maintenance_schedule_task_idx").on(table.taskId, table.createdAt),
    index("maintenance_schedule_home_idx").on(table.homeId, table.createdAt),
  ],
);

export const maintenanceRecurrenceRules = pgTable(
  "maintenance_recurrence_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").references(() => maintenanceTasks.id, {
      onDelete: "cascade",
    }),
    templateId: uuid("template_id").references(() => maintenanceTemplates.id, {
      onDelete: "cascade",
    }),
    rule: jsonb("rule").$type<AdvancedRecurrenceRule>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("maintenance_recurrence_task_unique").on(table.taskId),
    uniqueIndex("maintenance_recurrence_template_unique").on(table.templateId),
  ],
);

export const serviceProviders = pgTable(
  "service_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    specialties: jsonb("specialties").$type<string[]>().default([]).notNull(),
    notes: text("notes"),
    rating: integer("rating"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("service_providers_home_idx").on(table.homeId, table.archivedAt),
    uniqueIndex("service_providers_home_name_unique").on(table.homeId, table.name),
  ],
);

export const providerInterventions = pgTable(
  "provider_interventions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => serviceProviders.id, { onDelete: "cascade" }),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    maintenanceRecordId: uuid("maintenance_record_id").references(
      () => maintenanceRecords.id,
      { onDelete: "set null" },
    ),
    repairId: uuid("repair_id").references(() => repairRecords.id, {
      onDelete: "set null",
    }),
    renovationProjectId: uuid("renovation_project_id"),
    occurredAt: date("occurred_at").notNull(),
    notes: text("notes"),
    rating: integer("rating"),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    currency: text("currency").default("EUR").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("provider_interventions_provider_idx").on(table.providerId, table.occurredAt),
    index("provider_interventions_home_idx").on(table.homeId, table.occurredAt),
  ],
);

export const maintenanceRecordDocuments = pgTable(
  "maintenance_record_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    maintenanceRecordId: uuid("maintenance_record_id")
      .notNull()
      .references(() => maintenanceRecords.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("maintenance_record_documents_unique").on(
      table.maintenanceRecordId,
      table.documentId,
    ),
  ],
);

export const repairDocuments = pgTable(
  "repair_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repairId: uuid("repair_id")
      .notNull()
      .references(() => repairRecords.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("repair_documents_unique").on(table.repairId, table.documentId)],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    sku: text("sku"),
    quantity: integer("quantity").default(0).notNull(),
    unit: text("unit").default("piece").notNull(),
    reorderThreshold: integer("reorder_threshold").default(0).notNull(),
    location: text("location"),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
    currency: text("currency").default("EUR").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("inventory_items_home_idx").on(table.homeId, table.archivedAt),
    index("inventory_items_reorder_idx").on(table.homeId, table.quantity, table.reorderThreshold),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("inventory_movements_item_idx").on(table.itemId, table.createdAt)],
);

export const assetReplacementLinks = pgTable(
  "asset_replacement_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    predecessorAssetId: uuid("predecessor_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    successorAssetId: uuid("successor_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    replacedAt: date("replaced_at").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("asset_replacement_predecessor_unique").on(table.predecessorAssetId),
    uniqueIndex("asset_replacement_successor_unique").on(table.successorAssetId),
    index("asset_replacement_home_idx").on(table.homeId, table.replacedAt),
  ],
);

export const homeBudgets = pgTable(
  "home_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    currency: text("currency").default("EUR").notNull(),
    maintenanceBudget: numeric("maintenance_budget", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    repairBudget: numeric("repair_budget", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    replacementBudget: numeric("replacement_budget", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [uniqueIndex("home_budgets_home_year_unique").on(table.homeId, table.year)],
);

export const renovationProjects = pgTable(
  "renovation_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").default("PLANNING").notNull(),
    startDate: date("start_date"),
    targetEndDate: date("target_end_date"),
    completedAt: date("completed_at"),
    budget: numeric("budget", { precision: 12, scale: 2 }),
    currency: text("currency").default("EUR").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("renovation_projects_home_idx").on(table.homeId, table.archivedAt)],
);

export const renovationTasks = pgTable(
  "renovation_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => renovationProjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: date("due_date"),
    assignedTo: uuid("assigned_to").references(() => user.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [index("renovation_tasks_project_idx").on(table.projectId, table.sortOrder)],
);

export const renovationQuotes = pgTable(
  "renovation_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => renovationProjects.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id").references(() => serviceProviders.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("EUR").notNull(),
    status: text("status").default("RECEIVED").notNull(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [index("renovation_quotes_project_idx").on(table.projectId, table.status)],
);

export const renovationDocuments = pgTable(
  "renovation_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => renovationProjects.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("renovation_documents_unique").on(table.projectId, table.documentId)],
);

export const insuranceItems = pgTable(
  "insurance_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitValue: numeric("unit_value", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("EUR").notNull(),
    purchaseDate: date("purchase_date"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("insurance_items_home_idx").on(table.homeId, table.category),
    index("insurance_items_room_idx").on(table.roomId),
  ],
);
