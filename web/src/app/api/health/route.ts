import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { readMigrationLedgerSnapshot } from "@/server/db/migrationLedger";
import { withApiLogging } from "@/server/observability/apiRoute";
import pkg from "../../../../package.json";

const MIGRATIONS_DIR = path.join(process.cwd(), "src/server/db/migrations");
const MIGRATION_FILE_PATTERN = /^\d+_.+\.sql$/;

type HealthCheckResult = {
  ok: boolean;
  mode: "basic" | "deep";
  ts: string;
  version: string;
  checks: {
    db: boolean;
    requiredTables: {
      requested: string[];
      missing: string[];
    };
    migrations?: {
      localCount: number;
      appliedCount: number;
      pending: number;
      tableQualifiedName: string | null;
      latestAppliedAt: string | null;
      latestAppliedHash: string | null;
    };
  };
  error?: string;
};

function parseRequiredTables(raw: string | null) {
  const parsed = (raw ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter((token) => /^[a-zA-Z0-9_]+$/.test(token));
  if (parsed.length === 0) return ["program_template"];
  return Array.from(new Set(parsed));
}

async function readLocalMigrationCount() {
  const files = await readdir(MIGRATIONS_DIR).catch(() => []);
  return files.filter((file) => MIGRATION_FILE_PATTERN.test(file)).length;
}

async function getMissingTables(requiredTables: string[]) {
  const missing: string[] = [];
  for (const table of requiredTables) {
    const row = await db.execute<{ regclass: string | null }>(
      sql`select to_regclass(${`public.${table}`}) as regclass`,
    );
    const exists = Boolean(row.rows[0]?.regclass);
    if (!exists) missing.push(table);
  }
  return missing;
}

async function GETImpl(req: Request) {
  const version = process.env.APP_VERSION ?? pkg.version ?? "unknown";
  const ts = new Date().toISOString();

  try {
    const { searchParams } = new URL(req.url);
    const deepCheck = searchParams.get("checkMigrations") === "1";
    const requiredTables = parseRequiredTables(searchParams.get("requiredTables"));

    await db.execute(sql`select 1`);

    const missingTables = await getMissingTables(requiredTables);

    if (!deepCheck) {
      const payload: HealthCheckResult = {
        ok: missingTables.length === 0,
        mode: "basic",
        ts,
        version,
        checks: {
          db: true,
          requiredTables: {
            requested: requiredTables,
            missing: missingTables,
          },
        },
        error: missingTables.length > 0 ? "required tables missing" : undefined,
      };
      return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
    }

    const [localCount, migrationLedger] = await Promise.all([
      readLocalMigrationCount(),
      readMigrationLedgerSnapshot(),
    ]);

    const appliedCount = migrationLedger.appliedCount;
    const pending = migrationLedger.tableQualifiedName ? Math.max(0, localCount - appliedCount) : localCount;

    const ok = missingTables.length === 0 && pending === 0;
    const payload: HealthCheckResult = {
      ok,
      mode: "deep",
      ts,
      version,
      checks: {
        db: true,
        requiredTables: {
          requested: requiredTables,
          missing: missingTables,
        },
        migrations: {
          localCount,
          appliedCount,
          pending,
          tableQualifiedName: migrationLedger.tableQualifiedName,
          latestAppliedAt: migrationLedger.latestAppliedAt,
          latestAppliedHash: migrationLedger.latestAppliedHash,
        },
      },
      error: ok
        ? undefined
        : missingTables.length > 0
          ? "required tables missing"
          : migrationLedger.tableQualifiedName
            ? "pending migrations detected"
            : "migration metadata table missing",
    };

    return NextResponse.json(payload, { status: ok ? 200 : 503 });
  } catch (error: unknown) {
    const payload: HealthCheckResult = {
      ok: false,
      mode: "deep",
      ts,
      version,
      checks: {
        db: false,
        requiredTables: {
          requested: ["program_template"],
          missing: ["program_template"],
        },
      },
      error: error instanceof Error ? error.message : "db check failed",
    };
    return NextResponse.json(payload, { status: 503 });
  }
}

export const GET = withApiLogging(GETImpl);
