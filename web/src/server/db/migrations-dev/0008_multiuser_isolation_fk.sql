-- DEV-schema data reconciliation (see docs/db-multiuser-isolation-plan.md §5 Phase 2).
-- Prod (migrations/0025) uses a DIFFERENT reconciliation: prod has no `local-user`
-- fallback rows, so it neither seeds the canonical app_user nor reassigns them.
--
-- 1) Ensure the canonical local/dev fallback account exists so its data can gain a valid FK.
INSERT INTO "dev"."app_user" (id, email, password_hash, display_name)
VALUES ('00000000-0000-4000-8000-000000c1c1c1', 'local-dev-fallback@localhost', 'local-dev-no-login', 'Local Dev Fallback')
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
-- 2) Reassign non-uuid fallback rows (WORKOUT_AUTH_USER_ID=local-user, seed default "dev") to the canonical uuid.
UPDATE "dev"."plan" SET user_id = '00000000-0000-4000-8000-000000c1c1c1' WHERE user_id IN ('local-user', 'dev');--> statement-breakpoint
UPDATE "dev"."plan_runtime_state" SET user_id = '00000000-0000-4000-8000-000000c1c1c1' WHERE user_id IN ('local-user', 'dev');--> statement-breakpoint
UPDATE "dev"."generated_session" SET user_id = '00000000-0000-4000-8000-000000c1c1c1' WHERE user_id IN ('local-user', 'dev');--> statement-breakpoint
UPDATE "dev"."workout_log" SET user_id = '00000000-0000-4000-8000-000000c1c1c1' WHERE user_id IN ('local-user', 'dev');--> statement-breakpoint
UPDATE "dev"."plan_progress_event" SET user_id = '00000000-0000-4000-8000-000000c1c1c1' WHERE user_id IN ('local-user', 'dev');--> statement-breakpoint
UPDATE "dev"."stats_cache" SET user_id = '00000000-0000-4000-8000-000000c1c1c1' WHERE user_id IN ('local-user', 'dev');--> statement-breakpoint
UPDATE "dev"."user_setting" SET user_id = '00000000-0000-4000-8000-000000c1c1c1' WHERE user_id IN ('local-user', 'dev');--> statement-breakpoint
-- 3) Delete orphan settings (valid uuid but no app_user). Preflight found 1 on dev.
DELETE FROM "dev"."user_setting" WHERE user_id NOT IN (SELECT id::text FROM "dev"."app_user");--> statement-breakpoint
-- 4) Type change (text -> uuid) with explicit cast, then FK to app_user with ON DELETE cascade.
ALTER TABLE "dev"."generated_session" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "dev"."plan" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "dev"."plan_progress_event" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "dev"."plan_runtime_state" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "dev"."program_template" ALTER COLUMN "owner_user_id" SET DATA TYPE uuid USING "owner_user_id"::uuid;--> statement-breakpoint
ALTER TABLE "dev"."stats_cache" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "dev"."user_setting" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "dev"."workout_log" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "dev"."generated_session" ADD CONSTRAINT "generated_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dev"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev"."plan" ADD CONSTRAINT "plan_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dev"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev"."plan_progress_event" ADD CONSTRAINT "plan_progress_event_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dev"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev"."plan_runtime_state" ADD CONSTRAINT "plan_runtime_state_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dev"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev"."program_template" ADD CONSTRAINT "program_template_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "dev"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev"."stats_cache" ADD CONSTRAINT "stats_cache_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dev"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev"."user_setting" ADD CONSTRAINT "user_setting_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dev"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev"."workout_log" ADD CONSTRAINT "workout_log_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dev"."app_user"("id") ON DELETE cascade ON UPDATE no action;
