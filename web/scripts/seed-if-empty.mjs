import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[seed-if-empty] DATABASE_URL is not set");
  process.exit(1);
}

function parsePositiveInt(raw, fallback) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

const maxAttempts = parsePositiveInt(process.env.DB_SEED_CHECK_MAX_ATTEMPTS, 20);
const retryDelayMs = parsePositiveInt(process.env.DB_SEED_CHECK_RETRY_DELAY_MS, 1500);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDb(pool) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      console.log(`[seed-if-empty] database not ready (${attempt}/${maxAttempts}), retrying...`);
      await sleep(retryDelayMs);
    }
  }
}

async function shouldSeed(pool) {
  const result = await pool.query(`
    select
      (select count(*)::int from program_template) as program_template_count,
      (select count(*)::int from exercise) as exercise_count
  `);

  const row = result.rows[0] ?? {};
  const programTemplateCount = Number(row.program_template_count ?? 0);
  const exerciseCount = Number(row.exercise_count ?? 0);
  console.log(
    `[seed-if-empty] counts program_template=${programTemplateCount}, exercise=${exerciseCount}`,
  );

  return programTemplateCount === 0 || exerciseCount === 0;
}

async function runSeedScript() {
  const seedScriptPath = path.resolve(process.cwd(), "src/server/db/seed.ts");
  if (!existsSync(seedScriptPath)) {
    throw new Error(`seed script not found: ${seedScriptPath}`);
  }

  const tsxCliPath = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  if (!existsSync(tsxCliPath)) {
    throw new Error(`tsx cli not found: ${tsxCliPath}`);
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCliPath, seedScriptPath], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(
        new Error(
          `[seed-if-empty] seed failed (code=${code ?? "null"}, signal=${signal ?? "none"})`,
        ),
      );
    });
  });
}

async function main() {
  const pool = new Pool({ connectionString });
  try {
    await waitForDb(pool);
    const doSeed = await shouldSeed(pool);

    if (!doSeed) {
      console.log("[seed-if-empty] seed skipped (existing data found)");
      return;
    }

    console.log("[seed-if-empty] empty base data detected, running db seed...");
    await runSeedScript();
    console.log("[seed-if-empty] seed completed");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[seed-if-empty] failed", error);
  process.exit(1);
});
