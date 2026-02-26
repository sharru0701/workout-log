import { NextResponse } from "next/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { uxEventLog } from "@/server/db/schema";
import { parseDateRangeFromSearchParams } from "@/server/stats/range";
import { getStatsCache, setStatsCache } from "@/server/stats/cache";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type UxEventSummary = {
  opens: number;
  modeChanges: number;
  generateClicks: number;
  generateSuccesses: number;
  addSheetOpens: number;
  addExerciseAdds: number;
  saveClicks: number;
  saveSuccesses: number;
  saveFailures: number;
  repeatClicks: number;
  repeatSuccesses: number;
};

type UxEventRates = {
  saveSuccessFromClicks: number;
  generateSuccessFromClicks: number;
  addAfterSheetOpen: number;
  repeatSuccessFromClicks: number;
  saveSuccessFromOpens: number;
};

type UxEventSummaryPayload = {
  from: string;
  to: string;
  rangeDays: number;
  totalEvents: number;
  summary: UxEventSummary;
  rates: UxEventRates;
  previous?: {
    totalEvents: number;
    summary: UxEventSummary;
    rates: UxEventRates;
  };
  trend?: {
    totalEventsDelta: number;
    opensDelta: number;
    modeChangesDelta: number;
    generateSuccessesDelta: number;
    saveSuccessesDelta: number;
    addExerciseAddsDelta: number;
    saveSuccessFromClicksDelta: number;
    saveSuccessFromOpensDelta: number;
  };
};

function toRatio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function buildRates(summary: UxEventSummary): UxEventRates {
  return {
    saveSuccessFromClicks: toRatio(summary.saveSuccesses, summary.saveClicks),
    generateSuccessFromClicks: toRatio(summary.generateSuccesses, summary.generateClicks),
    addAfterSheetOpen: toRatio(summary.addExerciseAdds, summary.addSheetOpens),
    repeatSuccessFromClicks: toRatio(summary.repeatSuccesses, summary.repeatClicks),
    saveSuccessFromOpens: toRatio(summary.saveSuccesses, summary.opens),
  };
}

async function computeSummary(input: { userId: string; from: Date; to: Date }) {
  const rows = await db
    .select({
      totalEvents: sql<number>`count(*)`,
      opens: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_log_opened')`,
      modeChanges: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_focus_mode_changed')`,
      generateClicks: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_generate_apply_clicked')`,
      generateSuccesses: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_generate_apply_succeeded')`,
      addSheetOpens: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_add_exercise_sheet_opened')`,
      addExerciseAdds: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_add_exercise_added')`,
      saveClicks: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_save_clicked')`,
      saveSuccesses: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_save_succeeded')`,
      saveFailures: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_save_failed')`,
      repeatClicks: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_repeat_last_clicked')`,
      repeatSuccesses: sql<number>`count(*) filter (where ${uxEventLog.name} = 'workout_repeat_last_succeeded')`,
    })
    .from(uxEventLog)
    .where(
      and(
        eq(uxEventLog.userId, input.userId),
        gte(uxEventLog.recordedAt, input.from),
        lte(uxEventLog.recordedAt, input.to),
      ),
    );

  const row = rows[0];
  const summary: UxEventSummary = {
    opens: Number(row?.opens ?? 0),
    modeChanges: Number(row?.modeChanges ?? 0),
    generateClicks: Number(row?.generateClicks ?? 0),
    generateSuccesses: Number(row?.generateSuccesses ?? 0),
    addSheetOpens: Number(row?.addSheetOpens ?? 0),
    addExerciseAdds: Number(row?.addExerciseAdds ?? 0),
    saveClicks: Number(row?.saveClicks ?? 0),
    saveSuccesses: Number(row?.saveSuccesses ?? 0),
    saveFailures: Number(row?.saveFailures ?? 0),
    repeatClicks: Number(row?.repeatClicks ?? 0),
    repeatSuccesses: Number(row?.repeatSuccesses ?? 0),
  };
  return {
    totalEvents: Number(row?.totalEvents ?? 0),
    summary,
    rates: buildRates(summary),
  };
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 14);
    const comparePrev = searchParams.get("comparePrev") === "1";

    const cacheParams = {
      from: from.toISOString(),
      to: to.toISOString(),
      comparePrev,
    };
    const cached = await getStatsCache<UxEventSummaryPayload>({
      userId,
      metric: "ux_events_summary",
      params: cacheParams,
      maxAgeSeconds: 120,
    });
    if (cached) return NextResponse.json(cached);

    const current = await computeSummary({ userId, from, to });
    let previous:
      | {
          totalEvents: number;
          summary: UxEventSummary;
          rates: UxEventRates;
        }
      | undefined;
    let trend:
      | {
          totalEventsDelta: number;
          opensDelta: number;
          modeChangesDelta: number;
          generateSuccessesDelta: number;
          saveSuccessesDelta: number;
          addExerciseAddsDelta: number;
          saveSuccessFromClicksDelta: number;
          saveSuccessFromOpensDelta: number;
        }
      | undefined;

    if (comparePrev) {
      const rangeMs = Math.max(1, to.getTime() - from.getTime());
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - rangeMs);
      const prev = await computeSummary({ userId, from: prevFrom, to: prevTo });
      previous = prev;
      trend = {
        totalEventsDelta: current.totalEvents - prev.totalEvents,
        opensDelta: current.summary.opens - prev.summary.opens,
        modeChangesDelta: current.summary.modeChanges - prev.summary.modeChanges,
        generateSuccessesDelta: current.summary.generateSuccesses - prev.summary.generateSuccesses,
        saveSuccessesDelta: current.summary.saveSuccesses - prev.summary.saveSuccesses,
        addExerciseAddsDelta: current.summary.addExerciseAdds - prev.summary.addExerciseAdds,
        saveSuccessFromClicksDelta:
          current.rates.saveSuccessFromClicks - prev.rates.saveSuccessFromClicks,
        saveSuccessFromOpensDelta: current.rates.saveSuccessFromOpens - prev.rates.saveSuccessFromOpens,
      };
    }

    const payload: UxEventSummaryPayload = {
      from: from.toISOString(),
      to: to.toISOString(),
      rangeDays,
      totalEvents: current.totalEvents,
      summary: current.summary,
      rates: current.rates,
      previous,
      trend,
    };

    await setStatsCache({
      userId,
      metric: "ux_events_summary",
      params: cacheParams,
      payload,
    });

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
