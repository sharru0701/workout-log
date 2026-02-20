ALTER TABLE "program_template" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "program_template" ADD COLUMN "parent_template_id" uuid;--> statement-breakpoint
ALTER TABLE "program_version" ADD COLUMN "parent_version_id" uuid;--> statement-breakpoint
CREATE INDEX "program_template_owner_idx" ON "program_template" USING btree ("owner_user_id");