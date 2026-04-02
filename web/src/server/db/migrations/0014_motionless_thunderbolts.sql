CREATE INDEX IF NOT EXISTS "generated_session_user_scheduled_at_idx" ON "generated_session" USING btree ("user_id",coalesce("scheduled_at", "updated_at"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workout_log_user_session_idx" ON "workout_log" USING btree ("user_id","generated_session_id");
