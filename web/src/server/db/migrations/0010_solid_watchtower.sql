CREATE TABLE IF NOT EXISTS "migration_run_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"runner" text NOT NULL,
	"host" text,
	"status" text NOT NULL,
	"error_code" text,
	"message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"lock_wait_ms" integer DEFAULT 0 NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "migration_run_log_run_id_uq" ON "migration_run_log" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "migration_run_log_started_idx" ON "migration_run_log" USING btree ("started_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "migration_run_log_status_started_idx" ON "migration_run_log" USING btree ("status","started_at" DESC);
