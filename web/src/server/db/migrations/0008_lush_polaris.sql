CREATE TABLE "ux_event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"client_event_id" text NOT NULL,
	"name" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_event_log_user_client_event_uq" ON "ux_event_log" USING btree ("user_id","client_event_id");--> statement-breakpoint
CREATE INDEX "ux_event_log_user_recorded_idx" ON "ux_event_log" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "ux_event_log_user_name_recorded_idx" ON "ux_event_log" USING btree ("user_id","name","recorded_at");
