import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

test("Vercel Preview cannot run database migrations", () => {
  const result = spawnSync(process.execPath, [path.join(scriptDir, "migrate.mjs")], {
    cwd: path.resolve(scriptDir, ".."),
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL_ENV: "preview",
      DB_MIGRATE_ENABLED: "1",
      DATABASE_URL: "",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /VERCEL_ENV=preview, skipping migrations/);
  assert.doesNotMatch(result.stdout, /run started|database not ready|migrations applied/);
});
