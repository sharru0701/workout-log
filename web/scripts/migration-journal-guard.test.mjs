import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Drizzle decides what to apply by comparing each journal entry's `when` against
// the single highest `created_at` already recorded, read once before the loop
// (drizzle-orm pg-core/dialect.js: `!lastDbMigration || Number(lastDbMigration
// .created_at) < migration.folderMillis`). So a migration whose `when` is lower
// than one already applied is skipped — permanently, on every later run.
//
// A fresh database has no recorded migration at all, so it applies everything in
// journal order regardless of timestamps. That is exactly why CI cannot catch
// this: e2e runs against an empty Postgres and stays green while production
// silently never applies the migration. It already happened once —
// 0013_perf_indexes was authored with a `when` below every other entry and is
// absent from production's __drizzle_migrations to this day (its index survives
// only because someone created it by hand).
//
// These checks are the gate that stops it recurring.

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(scriptDir, "../src/server/db");

// Every migration folder drizzle.config.ts can target: the default one and the
// DB_SCHEMA-scoped variants (migrations-dev).
const migrationDirs = fs
  .readdirSync(dbDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^migrations(-.+)?$/.test(e.name))
  .map((e) => path.join(dbDir, e.name));

test("migration folders are discovered", () => {
  assert.ok(migrationDirs.length > 0, `no migration folder under ${dbDir}`);
});

for (const dir of migrationDirs) {
  const label = path.basename(dir);
  const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta/_journal.json"), "utf8"));

  test(`${label}: journal timestamps increase strictly`, () => {
    for (let i = 1; i < journal.entries.length; i++) {
      const prev = journal.entries[i - 1];
      const cur = journal.entries[i];
      assert.ok(
        cur.when > prev.when,
        `${cur.tag} (when=${cur.when}) is not newer than ${prev.tag} (when=${prev.when}). ` +
          `Drizzle would skip it on every database that already applied ${prev.tag}, ` +
          `while a fresh CI database applies it and stays green. Give it a timestamp ` +
          `above every earlier entry.`,
      );
    }
  });

  test(`${label}: journal indexes are sequential`, () => {
    journal.entries.forEach((entry, i) => {
      assert.equal(entry.idx, i, `entry ${entry.tag} has idx ${entry.idx}, expected ${i}`);
    });
  });

  test(`${label}: every journal entry has its SQL file`, () => {
    for (const entry of journal.entries) {
      const file = path.join(dir, `${entry.tag}.sql`);
      assert.ok(fs.existsSync(file), `journal lists ${entry.tag} but ${file} is missing`);
    }
  });

  test(`${label}: every SQL file is listed in the journal`, () => {
    const tags = new Set(journal.entries.map((e) => e.tag));
    const orphans = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""))
      .filter((tag) => !tags.has(tag));
    assert.deepEqual(
      orphans,
      [],
      `these .sql files are not in the journal and would never run: ${orphans.join(", ")}`,
    );
  });
}
