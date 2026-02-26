import { NextResponse } from "next/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { generatedSession, workoutLog, workoutSet } from "@/server/db/schema";
import { parseDateRangeFromSearchParams } from "@/server/stats/range";
import { getStatsCache, setStatsCache } from "@/server/stats/cache";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type FunnelStep = {
  id: "generated_sessions" | "saved_logs" | "saved_logs_with_extra";
  label: string;
  count: number;
  conversionFromPrevious: number | null;
};

type FunnelTotals = {
  generatedSessions: number;
  savedLogs: number;
  savedLogsWithGeneratedSession: number;
  savedLogsWithExtraExercise: number;
  totalSets: number;
  extraSets: number;
  avgSetsPerLog: number;
};

type FunnelRates = {
  saveFromGenerate: number;
  extraFromSaved: number;
  generatedPerDay: number;
  savedPerDay: number;
};

type FunnelDropoff = {
  fromStepId: FunnelStep["id"];
  toStepId: FunnelStep["id"];
  dropCount: number;
  dropRate: number;
};

type UxFunnelPayload = {
  from: string;
  to: string;
  rangeDays: number;
  planId: string | null;
  totals: FunnelTotals;
  steps: FunnelStep[];
  rates: FunnelRates;
  dropoff: FunnelDropoff;
  previous?: {
    totals: FunnelTotals;
    rates: FunnelRates;
  };
  trend?: {
    generatedSessionsDelta: number;
    savedLogsDelta: number;
    saveFromGenerateDelta: number;
    extraFromSavedDelta: number;
  };
};

function toRatio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function buildSteps(totals: FunnelTotals): FunnelStep[] {
  return [
    {
      id: "generated_sessions",
      label: "세션 생성",
      count: totals.generatedSessions,
      conversionFromPrevious: null,
    },
    {
      id: "saved_logs",
      label: "기록 저장",
      count: totals.savedLogs,
      conversionFromPrevious: toRatio(totals.savedLogs, Math.max(1, totals.generatedSessions)),
    },
    {
      id: "saved_logs_with_extra",
      label: "추가 운동 포함 저장",
      count: totals.savedLogsWithExtraExercise,
      conversionFromPrevious: toRatio(totals.savedLogsWithExtraExercise, Math.max(1, totals.savedLogs)),
    },
  ];
}

function buildRates(totals: FunnelTotals, rangeDays: number): FunnelRates {
  return {
    saveFromGenerate: toRatio(totals.savedLogs, Math.max(1, totals.generatedSessions)),
    extraFromSaved: toRatio(totals.savedLogsWithExtraExercise, Math.max(1, totals.savedLogs)),
    generatedPerDay: Math.round((totals.generatedSessions / Math.max(1, rangeDays)) * 100) / 100,
    savedPerDay: Math.round((totals.savedLogs / Math.max(1, rangeDays)) * 100) / 100,
  };
}

function buildDropoff(steps: FunnelStep[]): FunnelDropoff {
  const [first, second, third] = steps;
  const drops = [
    {
      fromStepId: first.id,
      toStepId: second.id,
      dropCount: Math.max(0, first.count - second.count),
      dropRate: toRatio(Math.max(0, first.count - second.count), Math.max(1, first.count)),
    },
    {
      fromStepId: second.id,
      toStepId: third.id,
      dropCount: Math.max(0, second.count - third.count),
      dropRate: toRatio(Math.max(0, second.count - third.count), Math.max(1, second.count)),
    },
  ];

  drops.sort((a, b) => b.dropCount - a.dropCount || b.dropRate - a.dropRate);
  return drops[0];
}

function payloadToCsv(payload: UxFunnelPayload) {
  const lines: string[] = [
    "metric,value",
    `from,${payload.from}`,
    `to,${payload.to}`,
    `range_days,${payload.rangeDays}`,
    `plan_id,${payload.planId ?? "all"}`,
    `generated_sessions,${payload.totals.generatedSessions}`,
    `saved_logs,${payload.totals.savedLogs}`,
    `saved_logs_with_generated_session,${payload.totals.savedLogsWithGeneratedSession}`,
    `saved_logs_with_extra_exercise,${payload.totals.savedLogsWithExtraExercise}`,
    `total_sets,${payload.totals.totalSets}`,
    `extra_sets,${payload.totals.extraSets}`,
    `avg_sets_per_log,${payload.totals.avgSetsPerLog}`,
    `save_from_generate,${payload.rates.saveFromGenerate}`,
    `extra_from_saved,${payload.rates.extraFromSaved}`,
    `generated_per_day,${payload.rates.generatedPerDay}`,
    `saved_per_day,${payload.rates.savedPerDay}`,
    `largest_drop_from,${payload.dropoff.fromStepId}`,
    `largest_drop_to,${payload.dropoff.toStepId}`,
    `largest_drop_count,${payload.dropoff.dropCount}`,
    `largest_drop_rate,${payload.dropoff.dropRate}`,
  ];
  return lines.join("\n");
}

async function computeTotals(input: {
  userId: string;
  from: Date;
  to: Date;
  planId?: string | null;
}): Promise<FunnelTotals> {
  const { userId, from, to, planId } = input;

  const generatedWhere = and(
    eq(generatedSession.userId, userId),
    gte(generatedSession.createdAt, from),
    lte(generatedSession.createdAt, to),
    planId ? eq(generatedSession.planId, planId) : undefined,
  );
  const generatedRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(generatedSession)
    .where(generatedWhere);
  const generatedSessions = Number(generatedRows[0]?.count ?? 0);

  const logWhere = and(
    eq(workoutLog.userId, userId),
    gte(workoutLog.createdAt, from),
    lte(workoutLog.createdAt, to),
    planId ? eq(workoutLog.planId, planId) : undefined,
  );
  const logRows = await db
    .select({
      savedLogs: sql<number>`count(*)`,
      savedLogsWithGeneratedSession: sql<number>`count(case when ${workoutLog.generatedSessionId} is not null then 1 end)`,
    })
    .from(workoutLog)
    .where(logWhere);

  const savedLogs = Number(logRows[0]?.savedLogs ?? 0);
  const savedLogsWithGeneratedSession = Number(logRows[0]?.savedLogsWithGeneratedSession ?? 0);

  const setRows = await db
    .select({
      totalSets: sql<number>`count(*)`,
      extraSets: sql<number>`count(case when ${workoutSet.isExtra} then 1 end)`,
    })
    .from(workoutLog)
    .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
    .where(logWhere);

  const totalSets = Number(setRows[0]?.totalSets ?? 0);
  const extraSets = Number(setRows[0]?.extraSets ?? 0);

  const extraLogRows = await db
    .select({ count: sql<number>`count(distinct ${workoutSet.logId})` })
    .from(workoutLog)
    .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
    .where(and(logWhere, eq(workoutSet.isExtra, true)));
  const savedLogsWithExtraExercise = Number(extraLogRows[0]?.count ?? 0);

  return {
    generatedSessions,
    savedLogs,
    savedLogsWithGeneratedSession,
    savedLogsWithExtraExercise,
    totalSets,
    extraSets,
    avgSetsPerLog: savedLogs > 0 ? Math.round((totalSets / savedLogs) * 100) / 100 : 0,
  };
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const planId = searchParams.get("planId")?.trim() || null;
    const format = (searchParams.get("format") ?? "json").toLowerCase();
    const comparePrev = searchParams.get("comparePrev") === "1";
    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 30);

    const cacheParams = {
      from: from.toISOString(),
      to: to.toISOString(),
      planId,
      comparePrev,
      format,
    };

    const cached = await getStatsCache<UxFunnelPayload>({
      userId,
      metric: "ux_funnel",
      params: cacheParams,
      maxAgeSeconds: 300,
    });

    if (cached && format === "json") {
      return NextResponse.json(cached);
    }

    const totals = await computeTotals({ userId, from, to, planId });
    const steps = buildSteps(totals);
    const rates = buildRates(totals, rangeDays);
    const dropoff = buildDropoff(steps);

    let previous:
      | {
          totals: FunnelTotals;
          rates: FunnelRates;
        }
      | undefined;
    let trend:
      | {
          generatedSessionsDelta: number;
          savedLogsDelta: number;
          saveFromGenerateDelta: number;
          extraFromSavedDelta: number;
        }
      | undefined;

    if (comparePrev) {
      const rangeMs = Math.max(1, to.getTime() - from.getTime());
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - rangeMs);
      const prevTotals = await computeTotals({ userId, from: prevFrom, to: prevTo, planId });
      const prevRates = buildRates(prevTotals, rangeDays);
      previous = {
        totals: prevTotals,
        rates: prevRates,
      };
      trend = {
        generatedSessionsDelta: totals.generatedSessions - prevTotals.generatedSessions,
        savedLogsDelta: totals.savedLogs - prevTotals.savedLogs,
        saveFromGenerateDelta: rates.saveFromGenerate - prevRates.saveFromGenerate,
        extraFromSavedDelta: rates.extraFromSaved - prevRates.extraFromSaved,
      };
    }

    const payload: UxFunnelPayload = {
      from: from.toISOString(),
      to: to.toISOString(),
      rangeDays,
      planId,
      totals,
      steps,
      rates,
      dropoff,
      previous,
      trend,
    };

    await setStatsCache({
      userId,
      metric: "ux_funnel",
      params: cacheParams,
      payload,
    });

    if (format === "csv") {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const csv = payloadToCsv(payload);
      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="workout-log-${userId}-ux-funnel-${stamp}.csv"`,
          "cache-control": "no-store",
        },
      });
    }

    if (format !== "json") {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 400 });
    }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    logError("api.handler_error", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging(GETImpl);
