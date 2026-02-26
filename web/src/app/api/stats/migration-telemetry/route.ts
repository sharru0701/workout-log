import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";

const MIGRATIONS_DIR = path.join(process.cwd(), "src/server/db/migrations");
const MIGRATION_FILE_PATTERN = /^\d+_.+\.sql$/;

type DashboardMigrationStatus = "ok" | "warn" | "critical";
type RunStatusFilter = "ALL" | "ISSUE" | "SUCCESS" | "RUNNING" | "LOCK_TIMEOUT" | "FAILED" | "SKIPPED";
type ExportFormat = "json" | "csv";

type DashboardMigrationTelemetryPayload = {
  ts: string;
  status: DashboardMigrationStatus;
  reasons: string[];
  filters: {
    lookbackMinutes: number;
    limit: number;
    runStatus: RunStatusFilter;
    format: ExportFormat;
  };
  checks: {
    migrations: {
      localCount: number;
      appliedCount: number;
      pending: number;
      latestAppliedAt: string | null;
      latestAppliedHash: string | null;
    };
    telemetry: {
      available: boolean;
      lookbackMinutes: number;
      alerts: {
        lockTimeoutCount: number;
        failedCount: number;
        skippedCount: number;
        latestFailureAt: string | null;
        avgLockWaitMs: number;
        maxLockWaitMs: number;
      };
      recentRuns: Array<{
        runId: string;
        runner: string;
        host: string | null;
        status: string;
        errorCode: string | null;
        message: string | null;
        startedAt: string;
        finishedAt: string | null;
        lockWaitMs: number;
      }>;
    };
  };
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

function parseRunStatusFilter(raw: string | null): RunStatusFilter {
  const normalized = (raw ?? "ALL").trim().toUpperCase();
  if (normalized === "ALL") return "ALL";
  if (normalized === "ISSUE") return "ISSUE";
  if (normalized === "SUCCESS") return "SUCCESS";
  if (normalized === "RUNNING") return "RUNNING";
  if (normalized === "LOCK_TIMEOUT") return "LOCK_TIMEOUT";
  if (normalized === "FAILED") return "FAILED";
  if (normalized === "SKIPPED") return "SKIPPED";
  return "ALL";
}

function parseExportFormat(raw: string | null): ExportFormat {
  if ((raw ?? "").trim().toLowerCase() === "csv") return "csv";
  return "json";
}

function runStatusFilterSql(runStatus: RunStatusFilter) {
  if (runStatus === "ALL") return sql``;
  if (runStatus === "ISSUE") return sql`and status in ('LOCK_TIMEOUT', 'FAILED', 'SKIPPED')`;
  return sql`and status = ${runStatus}`;
}

function encodeCsvValue(value: unknown) {
  const str = value == null ? "" : String(value);
  if (!/[",\n]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsv(payload: DashboardMigrationTelemetryPayload) {
  const header = [
    "ts",
    "dashboardStatus",
    "reasons",
    "lookbackMinutes",
    "runFilter",
    "localCount",
    "appliedCount",
    "pending",
    "latestAppliedAt",
    "latestAppliedHash",
    "runStartedAt",
    "runFinishedAt",
    "runStatus",
    "runner",
    "host",
    "lockWaitMs",
    "errorCode",
    "message",
    "runId",
  ];

  const rows = payload.checks.telemetry.recentRuns.map((run) => [
    payload.ts,
    payload.status,
    payload.reasons.join("|"),
    payload.filters.lookbackMinutes,
    payload.filters.runStatus,
    payload.checks.migrations.localCount,
    payload.checks.migrations.appliedCount,
    payload.checks.migrations.pending,
    payload.checks.migrations.latestAppliedAt ?? "",
    payload.checks.migrations.latestAppliedHash ?? "",
    run.startedAt,
    run.finishedAt ?? "",
    run.status,
    run.runner,
    run.host ?? "",
    run.lockWaitMs,
    run.errorCode ?? "",
    run.message ?? "",
    run.runId,
  ]);

  const lines = [header, ...rows].map((row) => row.map((value) => encodeCsvValue(value)).join(","));
  return `${lines.join("\n")}\n`;
}

async function readLocalMigrationCount() {
  const files = await readdir(MIGRATIONS_DIR).catch(() => []);
  return files.filter((file) => MIGRATION_FILE_PATTERN.test(file)).length;
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lookbackMinutes = parseBoundedInt(searchParams.get("lookbackMinutes"), 720, 30, 10080);
    const limit = parseBoundedInt(searchParams.get("limit"), 8, 1, 50);
    const runStatus = parseRunStatusFilter(searchParams.get("runStatus"));
    const format = parseExportFormat(searchParams.get("format"));

    const [localCount, appliedCountRow, latestAppliedRow, telemetryTableRow] = await Promise.all([
      readLocalMigrationCount(),
      db.execute<{ count: number | string }>(sql`select count(*)::int as count from "__drizzle_migrations"`),
      db.execute<{ created_at: string | null; hash: string | null }>(
        sql`select created_at, hash from "__drizzle_migrations" order by created_at desc limit 1`,
      ),
      db.execute<{ regclass: string | null }>(sql`select to_regclass('public.migration_run_log') as regclass`),
    ]);

    const appliedCount = parseNumber(appliedCountRow.rows[0]?.count, 0);
    const pending = Math.max(0, localCount - appliedCount);
    const latestApplied = latestAppliedRow.rows[0];
    const telemetryAvailable = Boolean(telemetryTableRow.rows[0]?.regclass);

    const alerts = {
      lockTimeoutCount: 0,
      failedCount: 0,
      skippedCount: 0,
      latestFailureAt: null as string | null,
      avgLockWaitMs: 0,
      maxLockWaitMs: 0,
    };
    let recentRuns: DashboardMigrationTelemetryPayload["checks"]["telemetry"]["recentRuns"] = [];

    if (telemetryAvailable) {
      const runStatusSql = runStatusFilterSql(runStatus);
      const [recentRunsRow, alertsRow] = await Promise.all([
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
            where started_at >= now() - (${lookbackMinutes} * interval '1 minute')
            ${runStatusSql}
            order by started_at desc
            limit ${limit}
          `,
        ),
        db.execute<{
          lock_timeout_count: number | string;
          failed_count: number | string;
          skipped_count: number | string;
          latest_failure_at: string | null;
          avg_lock_wait_ms: number | string;
          max_lock_wait_ms: number | string;
        }>(
          sql`
            select
              count(*) filter (where status = 'LOCK_TIMEOUT')::int as lock_timeout_count,
              count(*) filter (where status = 'FAILED')::int as failed_count,
              count(*) filter (where status = 'SKIPPED')::int as skipped_count,
              max(case when status in ('FAILED', 'LOCK_TIMEOUT') then started_at end) as latest_failure_at,
              coalesce(avg(lock_wait_ms), 0)::float as avg_lock_wait_ms,
              coalesce(max(lock_wait_ms), 0)::int as max_lock_wait_ms
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

      const summary = alertsRow.rows[0];
      alerts.lockTimeoutCount = parseNumber(summary?.lock_timeout_count, 0);
      alerts.failedCount = parseNumber(summary?.failed_count, 0);
      alerts.skippedCount = parseNumber(summary?.skipped_count, 0);
      alerts.latestFailureAt = summary?.latest_failure_at ?? null;
      alerts.avgLockWaitMs = Math.round(parseNumber(summary?.avg_lock_wait_ms, 0));
      alerts.maxLockWaitMs = parseNumber(summary?.max_lock_wait_ms, 0);
    }

    const reasons: string[] = [];
    let status: DashboardMigrationStatus = "ok";

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
    if (status === "ok" && alerts.skippedCount > 0) {
      status = "warn";
      reasons.push("migration_skipped_recent");
    }
    if (status === "ok" && alerts.maxLockWaitMs >= 30000) {
      status = "warn";
      reasons.push("lock_wait_high_recent");
    }

    const payload: DashboardMigrationTelemetryPayload = {
      ts: new Date().toISOString(),
      status,
      reasons,
      filters: {
        lookbackMinutes,
        limit,
        runStatus,
        format,
      },
      checks: {
        migrations: {
          localCount,
          appliedCount,
          pending,
          latestAppliedAt: latestApplied?.created_at ?? null,
          latestAppliedHash: latestApplied?.hash ?? null,
        },
        telemetry: {
          available: telemetryAvailable,
          lookbackMinutes,
          alerts,
          recentRuns,
        },
      },
    };

    if (format === "csv") {
      const csv = buildCsv(payload);
      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="migration-telemetry.csv"',
          "cache-control": "no-store",
        },
      });
    }

    return NextResponse.json(payload, { status: status === "critical" ? 503 : 200 });
  } catch (error: unknown) {
    logError("api.handler_error", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging(GETImpl);
