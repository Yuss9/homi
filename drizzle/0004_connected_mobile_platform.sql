ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "barcode" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "snoozed_until" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "assets_home_barcode_idx" ON "assets" USING btree ("home_id", "barcode");
CREATE INDEX IF NOT EXISTS "notifications_user_snoozed_idx" ON "notifications" USING btree ("user_id", "snoozed_until");

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "token_prefix" text NOT NULL,
  "token_hash" text NOT NULL,
  "scopes" jsonb NOT NULL,
  "expires_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_token_hash_unique" ON "api_keys" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "api_keys_user_active_idx" ON "api_keys" USING btree ("user_id", "revoked_at");

CREATE TABLE IF NOT EXISTS "calendar_feeds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "home_id" uuid NOT NULL,
  "token_prefix" text NOT NULL,
  "token_hash" text NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "calendar_feeds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "calendar_feeds_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_feeds_token_hash_unique" ON "calendar_feeds" USING btree ("token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_feeds_user_home_unique" ON "calendar_feeds" USING btree ("user_id", "home_id");

CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "secret_ciphertext" text NOT NULL,
  "events" jsonb NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "last_success_at" timestamp with time zone,
  "disabled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "webhooks_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "webhooks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "webhooks_home_active_idx" ON "webhooks" USING btree ("home_id", "disabled_at");

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "webhook_id" uuid NOT NULL,
  "event" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "response_status" integer,
  "error" text,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "webhook_deliveries_pending_idx" ON "webhook_deliveries" USING btree ("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_idx" ON "webhook_deliveries" USING btree ("webhook_id", "created_at");

CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "home_id" uuid NOT NULL,
  "name" text NOT NULL,
  "query" text NOT NULL,
  "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saved_searches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "saved_searches_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_searches_user_home_name_unique" ON "saved_searches" USING btree ("user_id", "home_id", "name");
CREATE INDEX IF NOT EXISTS "saved_searches_user_home_idx" ON "saved_searches" USING btree ("user_id", "home_id");

CREATE TABLE IF NOT EXISTS "experience_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "locale" text DEFAULT 'en' NOT NULL,
  "dashboard_widgets" jsonb DEFAULT '["health","upcoming","summary","repairs","costs"]'::jsonb NOT NULL,
  "mobile_widget" jsonb DEFAULT '{"kind":"NEXT_MAINTENANCE"}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "experience_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "experience_preferences_user_unique" ON "experience_preferences" USING btree ("user_id");

CREATE TABLE IF NOT EXISTS "document_ocr" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "engine" text NOT NULL,
  "text" text NOT NULL,
  "language" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_ocr_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "document_ocr_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "document_ocr_document_unique" ON "document_ocr" USING btree ("document_id");
CREATE INDEX IF NOT EXISTS "document_ocr_creator_idx" ON "document_ocr" USING btree ("created_by");
