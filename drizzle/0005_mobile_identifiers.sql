CREATE TABLE IF NOT EXISTS "asset_identifiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "barcode" text NOT NULL,
  "format" text,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "asset_identifiers_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "asset_identifiers_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_identifiers_asset_unique" ON "asset_identifiers" USING btree ("asset_id");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_identifiers_barcode_unique" ON "asset_identifiers" USING btree ("barcode");

CREATE TABLE IF NOT EXISTS "notification_snoozes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "notification_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "snoozed_until" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_snoozes_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "notification_snoozes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_snoozes_notification_unique" ON "notification_snoozes" USING btree ("notification_id");
CREATE INDEX IF NOT EXISTS "notification_snoozes_user_until_idx" ON "notification_snoozes" USING btree ("user_id", "snoozed_until");
