CREATE INDEX IF NOT EXISTS "workout_set_exercise_name_lower_idx"
  ON "workout_set" USING btree (lower("exercise_name"));--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workout_log_user_day_bucket_utc_idx"
  ON "workout_log" USING btree ("user_id", date_trunc('day', "performed_at" at time zone 'UTC'));--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workout_log_user_week_bucket_utc_idx"
  ON "workout_log" USING btree ("user_id", date_trunc('week', "performed_at" at time zone 'UTC'));--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workout_log_user_month_bucket_utc_idx"
  ON "workout_log" USING btree ("user_id", date_trunc('month', "performed_at" at time zone 'UTC'));
