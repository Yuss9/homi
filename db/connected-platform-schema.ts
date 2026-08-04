import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { documents, homes, user } from "./schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export type ApiScope =
  | "home:read"
  | "maintenance:write"
  | "repairs:write"
  | "assets:read"
  | "calendar:read"
  | "widgets:read"
  | "webhooks:manage";

export type DashboardWidgetId =
  | "health"
  | "upcoming"
  | "summary"
  | "repairs"
  | "costs";

export type MobileWidgetKind =
  | "NEXT_MAINTENANCE"
  | "HOME_HEALTH"
  | "OPEN_REPAIRS"
  | "MONTHLY_COSTS"
  | "QUICK_ACTION";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull(),
    scopes: jsonb("scopes").$type<ApiScope[]>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("api_keys_token_hash_unique").on(table.tokenHash),
    index("api_keys_user_active_idx").on(table.userId, table.revokedAt),
  ],
);

export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("calendar_feeds_token_hash_unique").on(table.tokenHash),
    uniqueIndex("calendar_feeds_user_home_unique").on(
      table.userId,
      table.homeId,
    ),
  ],
);

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    events: jsonb("events").$type<string[]>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    failureCount: integer("failure_count").default(0).notNull(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("webhooks_home_active_idx").on(table.homeId, table.disabledAt),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").default("PENDING").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    responseStatus: integer("response_status"),
    error: text("error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("webhook_deliveries_pending_idx").on(
      table.status,
      table.nextAttemptAt,
    ),
    index("webhook_deliveries_webhook_idx").on(
      table.webhookId,
      table.createdAt,
    ),
  ],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: text("query").notNull(),
    filters: jsonb("filters")
      .$type<{ types?: string[]; statuses?: string[] }>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("saved_searches_user_home_name_unique").on(
      table.userId,
      table.homeId,
      table.name,
    ),
    index("saved_searches_user_home_idx").on(table.userId, table.homeId),
  ],
);

export const experiencePreferences = pgTable(
  "experience_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    locale: text("locale").default("en").notNull(),
    dashboardWidgets: jsonb("dashboard_widgets")
      .$type<DashboardWidgetId[]>()
      .default(["health", "upcoming", "summary", "repairs", "costs"])
      .notNull(),
    mobileWidget: jsonb("mobile_widget")
      .$type<{
        kind: MobileWidgetKind;
        homeId?: string;
        quickAction?: "SCAN" | "MAINTENANCE" | "REPAIR" | "CALENDAR";
      }>()
      .default({ kind: "NEXT_MAINTENANCE" })
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("experience_preferences_user_unique").on(table.userId),
  ],
);

export const documentOcr = pgTable(
  "document_ocr",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    engine: text("engine").notNull(),
    text: text("text").notNull(),
    language: text("language"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("document_ocr_document_unique").on(table.documentId),
    index("document_ocr_creator_idx").on(table.createdBy),
  ],
);
