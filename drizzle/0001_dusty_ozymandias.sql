CREATE TABLE "document_tag_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_tag_assignments" ADD CONSTRAINT "document_tag_assignments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tag_assignments" ADD CONSTRAINT "document_tag_assignments_tag_id_document_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."document_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_tag_assignment_unique" ON "document_tag_assignments" USING btree ("document_id","tag_id");--> statement-breakpoint
CREATE INDEX "document_tag_assignments_document_idx" ON "document_tag_assignments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_tag_assignments_tag_idx" ON "document_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_tags_home_name_unique" ON "document_tags" USING btree ("home_id","normalized_name");--> statement-breakpoint
CREATE INDEX "document_tags_home_idx" ON "document_tags" USING btree ("home_id");