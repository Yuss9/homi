CREATE TABLE IF NOT EXISTS "maintenance_template_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "title" text NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "template_checklist_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."maintenance_templates"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "template_checklist_template_idx" ON "maintenance_template_checklist_items" USING btree ("template_id", "sort_order");

CREATE TABLE IF NOT EXISTS "maintenance_task_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "title" text NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_checklist_task_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "task_checklist_completed_by_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "task_checklist_task_idx" ON "maintenance_task_checklist_items" USING btree ("task_id", "sort_order");
CREATE INDEX IF NOT EXISTS "task_checklist_completion_idx" ON "maintenance_task_checklist_items" USING btree ("task_id", "completed_at");

CREATE TABLE IF NOT EXISTS "maintenance_schedule_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "home_id" uuid NOT NULL,
  "action" text NOT NULL,
  "previous_due_at" timestamp with time zone NOT NULL,
  "new_due_at" timestamp with time zone NOT NULL,
  "reason" text NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "maintenance_schedule_task_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "maintenance_schedule_home_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "maintenance_schedule_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "maintenance_schedule_task_idx" ON "maintenance_schedule_events" USING btree ("task_id", "created_at");
CREATE INDEX IF NOT EXISTS "maintenance_schedule_home_idx" ON "maintenance_schedule_events" USING btree ("home_id", "created_at");

CREATE TABLE IF NOT EXISTS "maintenance_recurrence_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid,
  "template_id" uuid,
  "rule" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "maintenance_recurrence_task_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "maintenance_recurrence_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."maintenance_templates"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "maintenance_recurrence_target_check" CHECK (("task_id" IS NOT NULL AND "template_id" IS NULL) OR ("task_id" IS NULL AND "template_id" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_recurrence_task_unique" ON "maintenance_recurrence_rules" USING btree ("task_id");
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_recurrence_template_unique" ON "maintenance_recurrence_rules" USING btree ("template_id");

CREATE TABLE IF NOT EXISTS "service_providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "name" text NOT NULL,
  "company" text,
  "email" text,
  "phone" text,
  "website" text,
  "specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "rating" integer,
  "archived_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_providers_home_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "service_providers_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "service_providers_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);
CREATE INDEX IF NOT EXISTS "service_providers_home_idx" ON "service_providers" USING btree ("home_id", "archived_at");
CREATE UNIQUE INDEX IF NOT EXISTS "service_providers_home_name_unique" ON "service_providers" USING btree ("home_id", "name");

CREATE TABLE IF NOT EXISTS "maintenance_record_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "maintenance_record_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "maintenance_record_documents_record_fk" FOREIGN KEY ("maintenance_record_id") REFERENCES "public"."maintenance_records"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "maintenance_record_documents_document_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_record_documents_unique" ON "maintenance_record_documents" USING btree ("maintenance_record_id", "document_id");

CREATE TABLE IF NOT EXISTS "repair_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repair_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "repair_documents_repair_fk" FOREIGN KEY ("repair_id") REFERENCES "public"."repair_records"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "repair_documents_document_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "repair_documents_unique" ON "repair_documents" USING btree ("repair_id", "document_id");

CREATE TABLE IF NOT EXISTS "inventory_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "asset_id" uuid,
  "name" text NOT NULL,
  "sku" text,
  "quantity" integer DEFAULT 0 NOT NULL,
  "unit" text DEFAULT 'piece' NOT NULL,
  "reorder_threshold" integer DEFAULT 0 NOT NULL,
  "location" text,
  "unit_cost" numeric(12,2),
  "currency" text DEFAULT 'EUR' NOT NULL,
  "archived_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_items_home_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "inventory_items_asset_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "inventory_items_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "inventory_items_quantity_check" CHECK ("quantity" >= 0),
  CONSTRAINT "inventory_items_threshold_check" CHECK ("reorder_threshold" >= 0)
);
CREATE INDEX IF NOT EXISTS "inventory_items_home_idx" ON "inventory_items" USING btree ("home_id", "archived_at");
CREATE INDEX IF NOT EXISTS "inventory_items_reorder_idx" ON "inventory_items" USING btree ("home_id", "quantity", "reorder_threshold");

CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL,
  "delta" integer NOT NULL,
  "reason" text NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_movements_item_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "inventory_movements_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "inventory_movements_item_idx" ON "inventory_movements" USING btree ("item_id", "created_at");

CREATE TABLE IF NOT EXISTS "asset_replacement_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "predecessor_asset_id" uuid NOT NULL,
  "successor_asset_id" uuid NOT NULL,
  "replaced_at" date NOT NULL,
  "notes" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "asset_replacement_home_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "asset_replacement_predecessor_fk" FOREIGN KEY ("predecessor_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "asset_replacement_successor_fk" FOREIGN KEY ("successor_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "asset_replacement_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_replacement_distinct_check" CHECK ("predecessor_asset_id" <> "successor_asset_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_replacement_predecessor_unique" ON "asset_replacement_links" USING btree ("predecessor_asset_id");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_replacement_successor_unique" ON "asset_replacement_links" USING btree ("successor_asset_id");
CREATE INDEX IF NOT EXISTS "asset_replacement_home_idx" ON "asset_replacement_links" USING btree ("home_id", "replaced_at");

CREATE TABLE IF NOT EXISTS "home_budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "year" integer NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "maintenance_budget" numeric(12,2) DEFAULT 0 NOT NULL,
  "repair_budget" numeric(12,2) DEFAULT 0 NOT NULL,
  "replacement_budget" numeric(12,2) DEFAULT 0 NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "home_budgets_home_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "home_budgets_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "home_budgets_year_check" CHECK ("year" >= 2000 AND "year" <= 2200)
);
CREATE UNIQUE INDEX IF NOT EXISTS "home_budgets_home_year_unique" ON "home_budgets" USING btree ("home_id", "year");

CREATE TABLE IF NOT EXISTS "renovation_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'PLANNING' NOT NULL,
  "start_date" date,
  "target_end_date" date,
  "completed_at" date,
  "budget" numeric(12,2),
  "currency" text DEFAULT 'EUR' NOT NULL,
  "created_by" uuid NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "renovation_projects_home_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "renovation_projects_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "renovation_projects_home_idx" ON "renovation_projects" USING btree ("home_id", "archived_at");

CREATE TABLE IF NOT EXISTS "renovation_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "title" text NOT NULL,
  "due_date" date,
  "assigned_to" uuid,
  "completed_at" timestamp with time zone,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "renovation_tasks_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."renovation_projects"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "renovation_tasks_assigned_to_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "renovation_tasks_project_idx" ON "renovation_tasks" USING btree ("project_id", "sort_order");

CREATE TABLE IF NOT EXISTS "renovation_quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "provider_id" uuid,
  "description" text NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "status" text DEFAULT 'RECEIVED' NOT NULL,
  "document_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "renovation_quotes_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."renovation_projects"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "renovation_quotes_provider_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."service_providers"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "renovation_quotes_document_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "renovation_quotes_project_idx" ON "renovation_quotes" USING btree ("project_id", "status");

CREATE TABLE IF NOT EXISTS "renovation_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "renovation_documents_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."renovation_projects"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "renovation_documents_document_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "renovation_documents_unique" ON "renovation_documents" USING btree ("project_id", "document_id");

CREATE TABLE IF NOT EXISTS "provider_interventions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid NOT NULL,
  "home_id" uuid NOT NULL,
  "maintenance_record_id" uuid,
  "repair_id" uuid,
  "renovation_project_id" uuid,
  "occurred_at" date NOT NULL,
  "notes" text,
  "rating" integer,
  "cost" numeric(12,2),
  "currency" text DEFAULT 'EUR' NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "provider_interventions_provider_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."service_providers"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "provider_interventions_home_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "provider_interventions_maintenance_fk" FOREIGN KEY ("maintenance_record_id") REFERENCES "public"."maintenance_records"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "provider_interventions_repair_fk" FOREIGN KEY ("repair_id") REFERENCES "public"."repair_records"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "provider_interventions_renovation_fk" FOREIGN KEY ("renovation_project_id") REFERENCES "public"."renovation_projects"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "provider_interventions_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "provider_interventions_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);
CREATE INDEX IF NOT EXISTS "provider_interventions_provider_idx" ON "provider_interventions" USING btree ("provider_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "provider_interventions_home_idx" ON "provider_interventions" USING btree ("home_id", "occurred_at");

CREATE TABLE IF NOT EXISTS "insurance_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "room_id" uuid,
  "asset_id" uuid,
  "document_id" uuid,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_value" numeric(12,2) NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "purchase_date" date,
  "notes" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "insurance_items_home_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "insurance_items_room_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "insurance_items_asset_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "insurance_items_document_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "insurance_items_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "insurance_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "insurance_items_value_check" CHECK ("unit_value" >= 0)
);
CREATE INDEX IF NOT EXISTS "insurance_items_home_idx" ON "insurance_items" USING btree ("home_id", "category");
CREATE INDEX IF NOT EXISTS "insurance_items_room_idx" ON "insurance_items" USING btree ("room_id");
