import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { readMigrationLedgerSnapshot } from "@/server/db/migrationLedger";
import { withApiLogging } from "@/server/observability/apiRoute";

const MIGRATIONS_DIR = path.join(process.cwd(), "src/server/db/migrations");
const MIGRATION_FILE_PATTERN = /^\d+_.+\.sql$/;

type OpsMigrationStatus = "ok" | "warn" | "critical";

type MigrationRunSummary = {
  runId: string;
  runner: string;
  host: string | null;
  status: string;
  errorCode: string | null;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
  lockWaitMs: number;
};

type MigrationAlertSummary = {
  windowMinutes: number;
  lockTimeoutCount: number;
  failedCount: number;
  latestFailureAt: string | null;
};

type OpsMigrationResponse = {
  ok: boolean;
  status: OpsMigrationStatus;
  ts: string;
  checks: {
    migrations: {
      localCount: number;
      appliedCount: number;
      pending: number;
      tableQualifiedName: string | null;
    };
    telemetry: {
      available: boolean;
      recentRuns: MigrationRunSummary[];
      alerts: MigrationAlertSummary;
    };
  };
  reasons: string[];
};

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function extractToken(req: Request) {
  const headerToken = req.headers.get("x-ops-token")?.trim();
  if (headerToken) return headerToken;

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const bearerToken = authHeader.slice(7).trim();
  return bearerToken || null;
}

async function readLocalMigrationCount() {
  const files = await readdir(MIGRATIONS_DIR).catch(() => []);
  return files.filter((file) => MIGRATION_FILE_PATTERN.test(file)).length;
}

async function GETImpl(req: Request) {
  const expectedToken = (process.env.OPS_MIGRATION_TOKEN ?? "").trim();
  if (!expectedToken) {
    return NextResponse.json({ error: "ops migration endpoint disabled" }, { status: 404 });
  }

  const providedToken = extractToken(req);
  if (!providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lookbackMinutes = parseBoundedInt(searchParams.get("lookbackMinutes"), 120, 5, 1440);
  const limit = parseBoundedInt(searchParams.get("limit"), 20, 1, 100);

  const [localCount, migrationLedger, telemetryTableRow] = await Promise.all([
    readLocalMigrationCount(),
    readMigrationLedgerSnapshot(),
    db.execute<{ regclass: string | null }>(sql`select to_regclass('public.migration_run_log') as regclass`),
  ]);

  const appliedCount = migrationLedger.appliedCount;
  const pending = migrationLedger.tableQualifiedName ? Math.max(0, localCount - appliedCount) : localCount;
  const telemetryAvailable = Boolean(telemetryTableRow.rows[0]?.regclass);

  const alerts: MigrationAlertSummary = {
    windowMinutes: lookbackMinutes,
    lockTimeoutCount: 0,
    failedCount: 0,
    latestFailureAt: null,
  };
  let recentRuns: MigrationRunSummary[] = [];

  if (telemetryAvailable) {
    const [recentRunsRow, alertRow] = await Promise.all([
      db.execute<{
        run_id: string;
        runner: string;
        host: string | null;
        status: string;
        error_code: string | null;
        message: string | null;
        started_at: string;
        finished_at: string | null;
        lock_wait_ms: number | string;
      }>(
        sql`
          select
            run_id,
            runner,
            host,
            status,
            error_code,
            message,
            started_at,
            finished_at,
            lock_wait_ms
          from migration_run_log
          order by started_at desc
          limit ${limit}
        `,
      ),
      db.execute<{
        lock_timeout_count: number | string;
        failed_count: number | string;
        latest_failure_at: string | null;
      }>(
        sql`
          select
            count(*) filter (where status = 'LOCK_TIMEOUT')::int as lock_timeout_count,
            count(*) filter (where status = 'FAILED')::int as failed_count,
            max(case when status in ('FAILED', 'LOCK_TIMEOUT') then started_at end) as latest_failure_at
          from migration_run_log
          where started_at >= now() - (${lookbackMinutes} * interval '1 minute')
        `,
      ),
    ]);

    recentRuns = recentRunsRow.rows.map((row) => ({
      runId: row.run_id,
      runner: row.runner,
      host: row.host,
      status: row.status,
      errorCode: row.error_code,
      message: row.message,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      lockWaitMs: parseNumber(row.lock_wait_ms, 0),
    }));

    const summaryRow = alertRow.rows[0];
    alerts.lockTimeoutCount = parseNumber(summaryRow?.lock_timeout_count, 0);
    alerts.failedCount = parseNumber(summaryRow?.failed_count, 0);
    alerts.latestFailureAt = summaryRow?.latest_failure_at ?? null;
  }

  const reasons: string[] = [];
  let status: OpsMigrationStatus = "ok";

  if (!migrationLedger.tableQualifiedName) {
    status = "critical";
    reasons.push("migration_metadata_missing");
  }
  if (pending > 0) {
    status = "critical";
    reasons.push("pending_migrations");
  }
  if (!telemetryAvailable) {
    if (status === "ok") status = "warn";
    reasons.push("telemetry_table_missing");
  }
  if (alerts.lockTimeoutCount > 0) {
    status = "critical";
    reasons.push("lock_timeout_recent");
  }
  if (alerts.failedCount > 0) {
    status = "critical";
    reasons.push("migration_failed_recent");
  }

  const payload: OpsMigrationResponse = {
    ok: status !== "critical",
    status,
    ts: new Date().toISOString(),
    checks: {
      migrations: {
        localCount,
        appliedCount,
        pending,
        tableQualifiedName: migrationLedger.tableQualifiedName,
      },
      telemetry: {
        available: telemetryAvailable,
        recentRuns,
        alerts,
      },
    },
    reasons,
  };

  return NextResponse.json(payload, { status: status === "critical" ? 503 : 200 });
}

export const GET = withApiLogging(GETImpl);
