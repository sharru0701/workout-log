ALTER TABLE "workout_set"
ALTER COLUMN "weight_kg" SET DATA TYPE numeric(8, 2) USING "weight_kg"::numeric(8, 2);
