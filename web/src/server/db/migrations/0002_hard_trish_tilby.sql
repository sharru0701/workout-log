CREATE TABLE "workout_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" uuid,
	"generated_session_id" uuid,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_minutes" integer,
	"notes" text,
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" uuid NOT NULL,
	"exercise_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"set_number" integer DEFAULT 1 NOT NULL,
	"reps" integer,
	"weight_kg" integer,
	"rpe" integer,
	"is_extra" boolean DEFAULT false NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_log" ADD CONSTRAINT "workout_log_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_log" ADD CONSTRAINT "workout_log_generated_session_id_generated_session_id_fk" FOREIGN KEY ("generated_session_id") REFERENCES "public"."generated_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_log_id_workout_log_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."workout_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_log_user_performed_idx" ON "workout_log" USING btree ("user_id","performed_at");--> statement-breakpoint
CREATE INDEX "workout_log_plan_idx" ON "workout_log" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "workout_log_generated_session_idx" ON "workout_log" USING btree ("generated_session_id");--> statement-breakpoint
CREATE INDEX "workout_set_log_idx" ON "workout_set" USING btree ("log_id");--> statement-breakpoint
CREATE INDEX "workout_set_exercise_idx" ON "workout_set" USING btree ("exercise_name");