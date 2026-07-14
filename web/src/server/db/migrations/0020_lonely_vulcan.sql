ALTER TABLE "workout_log" ADD COLUMN "client_mutation_id" text;--> statement-breakpoint
ALTER TABLE "workout_log" ADD COLUMN "client_mutation_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_log_user_client_mutation_uq" ON "workout_log" USING btree ("user_id","client_mutation_id");