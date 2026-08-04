ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "repair_records" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
DROP INDEX IF EXISTS "room_home_name_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "room_home_name_unique" ON "rooms" USING btree ("home_id", "name") WHERE "archived_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rooms_active_idx" ON "rooms" USING btree ("home_id", "archived_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repairs_active_idx" ON "repair_records" USING btree ("home_id", "archived_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_active_idx" ON "documents" USING btree ("home_id", "archived_at");
