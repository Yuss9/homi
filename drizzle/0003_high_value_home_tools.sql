CREATE TABLE "maintenance_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "frequency_type" "frequency_type" NOT NULL,
  "frequency_interval" integer DEFAULT 1 NOT NULL,
  "priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
  "estimated_duration_minutes" integer,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_templates" ADD CONSTRAINT "maintenance_templates_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "maintenance_templates" ADD CONSTRAINT "maintenance_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "maintenance_templates_home_category_idx" ON "maintenance_templates" USING btree ("home_id","category");
--> statement-breakpoint
CREATE INDEX "maintenance_templates_active_idx" ON "maintenance_templates" USING btree ("home_id","archived_at");
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "last_success_at" timestamp with time zone,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "disabled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "push_subscriptions" USING btree ("endpoint");
--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_active_idx" ON "push_subscriptions" USING btree ("user_id","disabled_at");
