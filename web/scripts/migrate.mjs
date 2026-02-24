import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

const maxAttempts = Number.parseInt(process.env.DB_MIGRATE_MAX_ATTEMPTS ?? "30", 10);
const delayMs = Number.parseInt(process.env.DB_MIGRATE_RETRY_DELAY_MS ?? "2000", 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDatabase(pool) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      console.log(`[migrate] database not ready (${attempt}/${maxAttempts}), retrying...`);
      await sleep(delayMs);
    }
  }
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

try {
  await waitForDatabase(pool);
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  console.log("[migrate] migrations applied");
} catch (error) {
  console.error("[migrate] failed to apply migrations", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
