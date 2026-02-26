CREATE TABLE "user_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_setting_user_key_uq" ON "user_setting" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "user_setting_user_idx" ON "user_setting" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_setting_user_updated_idx" ON "user_setting" USING btree ("user_id","updated_at");
