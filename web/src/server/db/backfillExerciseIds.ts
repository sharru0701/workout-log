import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

/**
 * Backfill workout_set.exercise_id by exact exercise_name match.
 * Safe to run multiple times.
 */
async function main() {
  const inserted = await db.execute(sql`
    insert into "exercise" ("name")
    select distinct ws."exercise_name"
    from "workout_set" ws
    where ws."exercise_name" is not null
    on conflict ("name") do nothing
  `);

  const updated = await db.execute(sql`
    update "workout_set" ws
    set "exercise_id" = e."id"
    from "exercise" e
    where ws."exercise_id" is null
      and ws."exercise_name" = e."name"
  `);

  console.log("exercise backfill complete");
  console.log({ inserted, updated });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
