CREATE TYPE "public"."module_target" AS ENUM('SQUAT', 'BENCH', 'DEADLIFT', 'OHP', 'PULL', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."override_scope" AS ENUM('PLAN', 'WEEK', 'SESSION', 'EXERCISE');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('SINGLE', 'COMPOSITE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."program_type" AS ENUM('LOGIC', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('PLANNED', 'DONE', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."visibility_type" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TABLE "generated_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"session_key" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"status" "session_status" DEFAULT 'PLANNED' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "plan_type" NOT NULL,
	"root_program_version_id" uuid,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_module" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"target" "module_target" NOT NULL,
	"program_version_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"scope" "override_scope" NOT NULL,
	"week_number" integer,
	"session_key" text,
	"patch" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "program_type" NOT NULL,
	"visibility" "visibility_type" DEFAULT 'PUBLIC' NOT NULL,
	"description" text,
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"changelog" text,
	"definition" jsonb NOT NULL,
	"defaults" jsonb,
	"is_deprecated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "healthcheck" CASCADE;--> statement-breakpoint
ALTER TABLE "generated_session" ADD CONSTRAINT "generated_session_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_root_program_version_id_program_version_id_fk" FOREIGN KEY ("root_program_version_id") REFERENCES "public"."program_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_module" ADD CONSTRAINT "plan_module_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_module" ADD CONSTRAINT "plan_module_program_version_id_program_version_id_fk" FOREIGN KEY ("program_version_id") REFERENCES "public"."program_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_override" ADD CONSTRAINT "plan_override_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_version" ADD CONSTRAINT "program_version_template_id_program_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."program_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_session_user_idx" ON "generated_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_session_plan_idx" ON "generated_session" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generated_session_plan_session_uq" ON "generated_session" USING btree ("plan_id","session_key");--> statement-breakpoint
CREATE INDEX "plan_user_idx" ON "plan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plan_type_idx" ON "plan" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_module_plan_target_uq" ON "plan_module" USING btree ("plan_id","target");--> statement-breakpoint
CREATE INDEX "plan_module_plan_idx" ON "plan_module" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_override_plan_scope_idx" ON "plan_override" USING btree ("plan_id","scope");--> statement-breakpoint
CREATE INDEX "plan_override_plan_week_idx" ON "plan_override" USING btree ("plan_id","week_number");--> statement-breakpoint
CREATE UNIQUE INDEX "program_template_slug_uq" ON "program_template" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "program_template_type_idx" ON "program_template" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "program_version_template_version_uq" ON "program_version" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "program_version_template_idx" ON "program_version" USING btree ("template_id");