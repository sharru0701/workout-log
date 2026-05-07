CREATE TABLE "auth_oauth_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_oauth_provider_subject_uq" ON "auth_oauth_account" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "auth_oauth_user_idx" ON "auth_oauth_account" USING btree ("user_id");