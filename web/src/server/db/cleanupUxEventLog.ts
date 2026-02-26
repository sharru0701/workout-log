import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./client";

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const floored = Math.floor(parsed);
  if (floored < 1) return fallback;
  return floored;
}

function pickCountValue(rows: unknown[]) {
  const first = rows[0];
  if (!first || typeof first !== "object") return 0;
  const value = (first as Record<string, unknown>).count;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const errorRecord = error as Record<string, unknown>;
  const directCode = errorRecord.code;
  if (directCode === "42P01") return true;
  const cause = errorRecord.cause;
  if (!cause || typeof cause !== "object") return false;
  const causeCode = (cause as Record<string, unknown>).code;
  return causeCode === "42P01";
}

async function main() {
  const retentionDays = parsePositiveInt(process.env.UX_EVENTS_RETENTION_DAYS, 120);
  const dryRun = process.env.UX_EVENTS_CLEANUP_DRY_RUN === "1";
  const now = new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);

  console.log(
    `[ux-events-cleanup] retentionDays=${retentionDays} cutoff=${cutoff.toISOString()} dryRun=${dryRun}`,
  );

  let staleCountResult;
  try {
    staleCountResult = await db.execute(
      sql`select count(*)::int as count from "ux_event_log" where "recorded_at" < ${cutoff}`,
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn("[ux-events-cleanup] ux_event_log table not found, skipping cleanup");
      return;
    }
    throw error;
  }
  const staleCount = pickCountValue(staleCountResult.rows);
  console.log(`[ux-events-cleanup] staleRows=${staleCount}`);

  if (dryRun || staleCount <= 0) {
    console.log("[ux-events-cleanup] completed without delete");
    return;
  }

  const deleteResult = await db.execute(
    sql`delete from "ux_event_log" where "recorded_at" < ${cutoff}`,
  );
  const deletedRows = Number(deleteResult.rowCount ?? 0);
  console.log(`[ux-events-cleanup] deletedRows=${deletedRows}`);
}

main().catch((error) => {
  console.error("[ux-events-cleanup] failed", error);
  process.exit(1);
});
