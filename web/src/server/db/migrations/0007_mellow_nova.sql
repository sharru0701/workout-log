ALTER TABLE "program_template"
ADD CONSTRAINT "program_template_private_owner_ck"
CHECK ("visibility" <> 'PRIVATE' OR "owner_user_id" IS NOT NULL);--> statement-breakpoint

ALTER TABLE "plan"
ADD CONSTRAINT "plan_type_root_program_ck"
CHECK (
  ("type" IN ('SINGLE', 'MANUAL') AND "root_program_version_id" IS NOT NULL)
  OR ("type" = 'COMPOSITE' AND "root_program_version_id" IS NULL)
);--> statement-breakpoint

ALTER TABLE "plan_override"
ADD CONSTRAINT "plan_override_session_key_ck"
CHECK ("scope" <> 'SESSION' OR "session_key" IS NOT NULL);--> statement-breakpoint

ALTER TABLE "plan"
ADD CONSTRAINT "plan_id_user_id_uq" UNIQUE ("id", "user_id");--> statement-breakpoint

ALTER TABLE "generated_session"
ADD CONSTRAINT "generated_session_plan_user_fk"
FOREIGN KEY ("plan_id","user_id")
REFERENCES "public"."plan"("id","user_id")
ON DELETE cascade
ON UPDATE no action;
