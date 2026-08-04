import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { frequencyType, homes, priority, user } from "./schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const maintenanceTemplates = pgTable(
  "maintenance_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    frequencyType: frequencyType("frequency_type").notNull(),
    frequencyInterval: integer("frequency_interval").default(1).notNull(),
    priority: priority("priority").default("MEDIUM").notNull(),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("maintenance_templates_home_category_idx").on(
      table.homeId,
      table.category,
    ),
    index("maintenance_templates_active_idx").on(
      table.homeId,
      table.archivedAt,
    ),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    failureCount: integer("failure_count").default(0).notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_active_idx").on(
      table.userId,
      table.disabledAt,
    ),
  ],
);
