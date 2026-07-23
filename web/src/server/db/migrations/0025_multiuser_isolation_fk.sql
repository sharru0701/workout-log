-- PROD-schema user_id → uuid + FK(app_user) migration. See docs/db-multiuser-isolation-plan.md.
-- Prod has NO `local-user` fallback rows (WORKOUT_AUTH_USER_ID is unset in prod), so this
-- migration does NOT seed a canonical account or reassign anything. Instead it FAILS LOUD if
-- any target column holds a non-uuid or orphan user id, so such rows must be reconciled
-- (assigned to a real app_user or deleted) BEFORE this runs — never silently altered.
-- Run the read-only preflight (plan §2) against public first to confirm this is a no-op.
DO $$
DECLARE
  r record;
  bad bigint;
  uuid_re text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  FOR r IN
    SELECT t AS tbl, 'user_id' AS col FROM unnest(ARRAY[
      'plan','plan_runtime_state','generated_session','workout_log',
      'plan_progress_event','stats_cache','user_setting']) AS t
    UNION ALL SELECT 'program_template', 'owner_user_id'
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I WHERE %I IS NOT NULL AND (%I !~ %L OR (%I ~ %L AND %I::uuid NOT IN (SELECT id FROM app_user)))',
      r.tbl, r.col, r.col, uuid_re, r.col, uuid_re, r.col
    ) INTO bad;
    IF bad > 0 THEN
      RAISE EXCEPTION 'multiuser FK migration blocked: %.% has % row(s) with a non-uuid or orphan user id. Reconcile before applying (see docs/db-multiuser-isolation-plan.md §4.2).', r.tbl, r.col, bad;
    END IF;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "generated_session" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "plan" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "plan_progress_event" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "plan_runtime_state" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "program_template" ALTER COLUMN "owner_user_id" SET DATA TYPE uuid USING "owner_user_id"::uuid;--> statement-breakpoint
ALTER TABLE "stats_cache" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "user_setting" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "workout_log" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "generated_session" ADD CONSTRAINT "generated_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_progress_event" ADD CONSTRAINT "plan_progress_event_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_runtime_state" ADD CONSTRAINT "plan_runtime_state_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_template" ADD CONSTRAINT "program_template_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_cache" ADD CONSTRAINT "stats_cache_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setting" ADD CONSTRAINT "user_setting_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_log" ADD CONSTRAINT "workout_log_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
