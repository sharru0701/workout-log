CREATE TABLE "stats_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"metric" text NOT NULL,
	"params_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stats_cache_user_metric_params_uq" ON "stats_cache" USING btree ("user_id","metric","params_hash");--> statement-breakpoint
CREATE INDEX "stats_cache_user_idx" ON "stats_cache" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stats_cache_updated_at_idx" ON "stats_cache" USING btree ("updated_at");
