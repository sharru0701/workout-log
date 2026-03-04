CREATE TABLE "plan_progress_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"log_id" uuid,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"program_slug" text NOT NULL,
	"reason" text,
	"before_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_runtime_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"engine_version" integer DEFAULT 1 NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_progress_event" ADD CONSTRAINT "plan_progress_event_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_progress_event" ADD CONSTRAINT "plan_progress_event_log_id_workout_log_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."workout_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_runtime_state" ADD CONSTRAINT "plan_runtime_state_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_progress_event_plan_log_slug_uq" ON "plan_progress_event" USING btree ("plan_id","log_id","program_slug");--> statement-breakpoint
CREATE INDEX "plan_progress_event_plan_idx" ON "plan_progress_event" USING btree ("plan_id","created_at");--> statement-breakpoint
CREATE INDEX "plan_progress_event_user_idx" ON "plan_progress_event" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_runtime_state_plan_uq" ON "plan_runtime_state" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_runtime_state_user_idx" ON "plan_runtime_state" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plan_runtime_state_updated_at_idx" ON "plan_runtime_state" USING btree ("updated_at");