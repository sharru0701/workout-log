DO $migration$
DECLARE
  pull_up_id uuid;
  weighted_pull_up_id uuid;
BEGIN
  SELECT "id" INTO pull_up_id
  FROM "public"."exercise"
  WHERE "name" = 'Pull-Up'
  LIMIT 1;

  SELECT "id" INTO weighted_pull_up_id
  FROM "public"."exercise"
  WHERE "name" = 'Weighted Pull-Up'
  LIMIT 1;

  IF pull_up_id IS NULL AND weighted_pull_up_id IS NOT NULL THEN
    UPDATE "public"."exercise"
    SET "name" = 'Pull-Up', "category" = 'Back'
    WHERE "id" = weighted_pull_up_id;
    pull_up_id := weighted_pull_up_id;
    weighted_pull_up_id := NULL;
  ELSIF pull_up_id IS NULL THEN
    INSERT INTO "public"."exercise" ("name", "category")
    VALUES ('Pull-Up', 'Back')
    RETURNING "id" INTO pull_up_id;
  END IF;

  IF weighted_pull_up_id IS NOT NULL AND weighted_pull_up_id <> pull_up_id THEN
    UPDATE "public"."workout_set"
    SET "exercise_id" = pull_up_id
    WHERE "exercise_id" = weighted_pull_up_id;

    INSERT INTO "public"."exercise_alias" ("exercise_id", "alias")
    SELECT pull_up_id, "alias"
    FROM "public"."exercise_alias"
    WHERE "exercise_id" = weighted_pull_up_id
    ON CONFLICT ("alias") DO UPDATE
    SET "exercise_id" = excluded."exercise_id";

    DELETE FROM "public"."exercise"
    WHERE "id" = weighted_pull_up_id;
  END IF;
END
$migration$;
--> statement-breakpoint
INSERT INTO "public"."exercise_alias" ("exercise_id", "alias")
SELECT e."id", aliases."alias"
FROM (
  VALUES
    ('Weighted Pull-Up'),
    ('Weighted Pull Up'),
    ('Weighted Pullup'),
    ('중량 풀업'),
    ('중량풀업')
) AS aliases("alias")
JOIN "public"."exercise" e ON e."name" = 'Pull-Up'
ON CONFLICT ("alias") DO UPDATE
SET "exercise_id" = excluded."exercise_id";
--> statement-breakpoint
UPDATE "public"."workout_set" ws
SET "exercise_id" = e."id"
FROM "public"."exercise" e
WHERE e."name" = 'Pull-Up'
  AND lower(trim(ws."exercise_name")) IN (
    'weighted pull-up',
    'weighted pull up',
    'weighted pullup',
    '중량 풀업',
    '중량풀업'
  );
--> statement-breakpoint
UPDATE "public"."workout_log"
SET "personal_records" = NULL
WHERE "personal_records" IS NOT NULL;
--> statement-breakpoint
DELETE FROM "public"."stats_cache";
