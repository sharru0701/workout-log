import { NextResponse } from "next/server";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { workoutLog } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { requireAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";

function normalizeTimezone(raw: string | null): string {
  const tz = raw?.trim();
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * Returns workout days within a given month for the authenticated user.
 *
 * Query: year=YYYY, month=1..12, [timezone=Area/City]
 * Response: {
 *   year, month,
 *   days: number[],            // distinct days-of-month
 *   sessions: Array<{ day: number; logId: string; performedAt: string }>
 *                              // most recent log per day (sorted descending)
 * }
 */
async function GETImpl(req: Request) {
  try {
    const userId = await requireAuthenticatedUserId();
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    const timezone = normalizeTimezone(searchParams.get("timezone"));

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      year < 1970 ||
      year > 2999 ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: "year and month required" },
        { status: 400 },
      );
    }

    const monthStr = String(month).padStart(2, "0");
    // Range bounds in target timezone
    const start = `${year}-${monthStr}-01`;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const end = `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const startTs = sql`(to_date(${start}, 'YYYY-MM-DD')::timestamp at time zone ${timezone})`;
    const endTs = sql`(to_date(${end}, 'YYYY-MM-DD')::timestamp at time zone ${timezone})`;

    const dayExpr = sql<string>`
      to_char(${workoutLog.performedAt} at time zone ${timezone}, 'DD')
    `;

    const rows = await db
      .select({
        id: workoutLog.id,
        performedAt: workoutLog.performedAt,
        day: dayExpr,
      })
      .from(workoutLog)
      .where(
        and(
          eq(workoutLog.userId, userId),
          gte(workoutLog.performedAt, startTs),
          lt(workoutLog.performedAt, endTs),
        ),
      );

    // 날짜별 가장 최근 logId만 유지
    const latestByDay = new Map<
      number,
      { logId: string; performedAt: Date }
    >();
    for (const r of rows) {
      const n = Number((r as any).day);
      if (!Number.isFinite(n) || n < 1 || n > 31) continue;
      const cur = latestByDay.get(n);
      if (!cur || r.performedAt > cur.performedAt) {
        latestByDay.set(n, { logId: r.id, performedAt: r.performedAt });
      }
    }

    const days = Array.from(latestByDay.keys()).sort((a, b) => a - b);
    const sessions = days.map((day) => {
      const v = latestByDay.get(day)!;
      return {
        day,
        logId: v.logId,
        performedAt: v.performedAt.toISOString(),
      };
    });

    return NextResponse.json(
      { year, month, days, sessions },
      {
        headers: {
          "Cache-Control":
            "private, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
