CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_alias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_set" ADD COLUMN "exercise_id" uuid;--> statement-breakpoint
ALTER TABLE "exercise_alias" ADD CONSTRAINT "exercise_alias_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_name_uq" ON "exercise" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_alias_alias_uq" ON "exercise_alias" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "exercise_alias_exercise_idx" ON "exercise_alias" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "workout_set_exercise_id_idx" ON "workout_set" USING btree ("exercise_id");--> statement-breakpoint

INSERT INTO "exercise" ("name")
SELECT DISTINCT ws."exercise_name"
FROM "workout_set" ws
WHERE ws."exercise_name" IS NOT NULL
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint

UPDATE "workout_set" ws
SET "exercise_id" = e."id"
FROM "exercise" e
WHERE ws."exercise_id" IS NULL
  AND ws."exercise_name" = e."name";
