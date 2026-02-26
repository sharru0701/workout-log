import { NextResponse } from "next/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { generatedSession, uxEventLog, workoutLog, workoutSet } from "@/server/db/schema";
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

type UxFunnelSnapshot = {
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

type UxSummaryWindow = {
  days: number;
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

type UxThreshold = {
  id: string;
  label: string;
  value: number;
  target: number;
  status: "ok" | "warn";
  hint: string;
};

type UxThresholdTargets = {
  saveFromGenerate: number;
  saveSuccessFromClicks7d: number;
  addAfterSheetOpen14d: number;
};

type UxSnapshotPayload = {
  exportedAt: string;
  filters: {
    from: string;
    to: string;
    rangeDays: number;
    planId: string | null;
    comparePrev: boolean;
    windowDays: number[];
    thresholdTargets: UxThresholdTargets;
  };
  funnel: UxFunnelSnapshot;
  windows: UxSummaryWindow[];
  thresholds: UxThreshold[];
};

const DEFAULT_UX_THRESHOLD_TARGETS: UxThresholdTargets = {
  saveFromGenerate: 0.65,
  saveSuccessFromClicks7d: 0.6,
  addAfterSheetOpen14d: 0.35,
};

function toRatio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function parseThresholdTarget(raw: string | null, fallback: number) {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0.05, Math.min(0.99, parsed));
}

function parseThresholdTargets(searchParams: URLSearchParams): UxThresholdTargets {
  return {
    saveFromGenerate: parseThresholdTarget(
      searchParams.get("targetSaveFromGenerate"),
      DEFAULT_UX_THRESHOLD_TARGETS.saveFromGenerate,
    ),
    saveSuccessFromClicks7d: parseThresholdTarget(
      searchParams.get("targetSaveSuccessFromClicks7d"),
      DEFAULT_UX_THRESHOLD_TARGETS.saveSuccessFromClicks7d,
    ),
    addAfterSheetOpen14d: parseThresholdTarget(
      searchParams.get("targetAddAfterSheetOpen14d"),
      DEFAULT_UX_THRESHOLD_TARGETS.addAfterSheetOpen14d,
    ),
  };
}

function parseWindowDays(raw: string | null): number[] {
  if (!raw) return [1, 7, 14];
  const parsed = raw
    .split(",")
    .map((token) => Number(token.trim()))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.floor(value))
    .filter((value) => value >= 1 && value <= 60);
  const unique: number[] = [];
  for (const dayValue of parsed) {
    if (!unique.includes(dayValue)) unique.push(dayValue);
    if (unique.length >= 6) break;
  }
  return unique.length ? unique : [1, 7, 14];
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

function buildFunnelRates(totals: FunnelTotals, rangeDays: number): FunnelRates {
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

function buildUxRates(summary: UxEventSummary): UxEventRates {
  return {
    saveSuccessFromClicks: toRatio(summary.saveSuccesses, summary.saveClicks),
    generateSuccessFromClicks: toRatio(summary.generateSuccesses, summary.generateClicks),
    addAfterSheetOpen: toRatio(summary.addExerciseAdds, summary.addSheetOpens),
    repeatSuccessFromClicks: toRatio(summary.repeatSuccesses, summary.repeatClicks),
    saveSuccessFromOpens: toRatio(summary.saveSuccesses, summary.opens),
  };
}

function buildThreshold(input: {
  id: string;
  label: string;
  value: number;
  target: number;
  warnHint: string;
  okHint: string;
}): UxThreshold {
  const status: UxThreshold["status"] = input.value >= input.target ? "ok" : "warn";
  return {
    id: input.id,
    label: input.label,
    value: input.value,
    target: input.target,
    status,
    hint: status === "ok" ? input.okHint : input.warnHint,
  };
}

function buildThresholds(input: {
  funnel: UxFunnelSnapshot;
  windows: UxSummaryWindow[];
  targets: UxThresholdTargets;
}): UxThreshold[] {
  const { funnel, windows, targets } = input;
  const sevenDay = windows.find((window) => window.days === 7) ?? windows[0];
  const fourteenDay = windows.find((window) => window.days === 14) ?? sevenDay;

  return [
    buildThreshold({
      id: "funnel_save_from_generate",
      label: "세션 생성→저장 전환율",
      value: funnel.rates.saveFromGenerate,
      target: targets.saveFromGenerate,
      warnHint: "생성 후 저장까지 이어지는 사용자가 적습니다. 저장 직전 마찰 구간을 확인하세요.",
      okHint: "생성 후 저장 전환이 기준치를 유지하고 있습니다.",
    }),
    buildThreshold({
      id: "save_success_from_clicks_7d",
      label: "7일 저장 클릭→성공율",
      value: sevenDay?.rates.saveSuccessFromClicks ?? 0,
      target: targets.saveSuccessFromClicks7d,
      warnHint: "저장 클릭 대비 성공이 낮습니다. 실패 이벤트와 오프라인 큐 비율을 점검하세요.",
      okHint: "저장 클릭 대비 성공률이 안정적입니다.",
    }),
    buildThreshold({
      id: "add_after_sheet_open_14d",
      label: "14일 시트 오픈→운동 추가율",
      value: fourteenDay?.rates.addAfterSheetOpen ?? 0,
      target: targets.addAfterSheetOpen14d,
      warnHint: "운동 추가 시트에서 실제 추가 전환이 낮습니다. 검색/추천 목록 진입성을 보완하세요.",
      okHint: "운동 추가 시트 전환이 기준치를 유지하고 있습니다.",
    }),
  ];
}

function csvEscape(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (!raw.includes(",") && !raw.includes("\"") && !raw.includes("\n")) {
    return raw;
  }
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}

function payloadToCsv(payload: UxSnapshotPayload) {
  const lines: string[] = ["section,metric,value"];
  lines.push(`meta,exported_at,${csvEscape(payload.exportedAt)}`);
  lines.push(`meta,from,${csvEscape(payload.filters.from)}`);
  lines.push(`meta,to,${csvEscape(payload.filters.to)}`);
  lines.push(`meta,range_days,${payload.filters.rangeDays}`);
  lines.push(`meta,plan_id,${csvEscape(payload.filters.planId ?? "all")}`);
  lines.push(`meta,compare_prev,${payload.filters.comparePrev ? 1 : 0}`);
  lines.push(`meta,window_days,${csvEscape(payload.filters.windowDays.join(","))}`);
  lines.push(`meta,target_save_from_generate,${payload.filters.thresholdTargets.saveFromGenerate}`);
  lines.push(
    `meta,target_save_success_from_clicks_7d,${payload.filters.thresholdTargets.saveSuccessFromClicks7d}`,
  );
  lines.push(
    `meta,target_add_after_sheet_open_14d,${payload.filters.thresholdTargets.addAfterSheetOpen14d}`,
  );

  lines.push(`funnel,generated_sessions,${payload.funnel.totals.generatedSessions}`);
  lines.push(`funnel,saved_logs,${payload.funnel.totals.savedLogs}`);
  lines.push(
    `funnel,saved_logs_with_extra_exercise,${payload.funnel.totals.savedLogsWithExtraExercise}`,
  );
  lines.push(`funnel,save_from_generate,${payload.funnel.rates.saveFromGenerate}`);
  lines.push(`funnel,extra_from_saved,${payload.funnel.rates.extraFromSaved}`);
  lines.push(`funnel,dropoff_from,${csvEscape(payload.funnel.dropoff.fromStepId)}`);
  lines.push(`funnel,dropoff_to,${csvEscape(payload.funnel.dropoff.toStepId)}`);
  lines.push(`funnel,dropoff_count,${payload.funnel.dropoff.dropCount}`);

  for (const window of payload.windows) {
    const prefix = `window_${window.days}d`;
    lines.push(`${prefix},total_events,${window.totalEvents}`);
    lines.push(`${prefix},opens,${window.summary.opens}`);
    lines.push(`${prefix},generate_successes,${window.summary.generateSuccesses}`);
    lines.push(`${prefix},save_successes,${window.summary.saveSuccesses}`);
    lines.push(`${prefix},add_exercise_adds,${window.summary.addExerciseAdds}`);
    lines.push(`${prefix},save_success_from_clicks,${window.rates.saveSuccessFromClicks}`);
    lines.push(`${prefix},save_success_from_opens,${window.rates.saveSuccessFromOpens}`);
    lines.push(`${prefix},add_after_sheet_open,${window.rates.addAfterSheetOpen}`);
    lines.push(`${prefix},save_successes_delta,${window.trend?.saveSuccessesDelta ?? 0}`);
    lines.push(
      `${prefix},save_success_rate_delta,${window.trend?.saveSuccessFromClicksDelta ?? 0}`,
    );
  }

  for (const threshold of payload.thresholds) {
    const prefix = `threshold_${threshold.id}`;
    lines.push(`${prefix},label,${csvEscape(threshold.label)}`);
    lines.push(`${prefix},value,${threshold.value}`);
    lines.push(`${prefix},target,${threshold.target}`);
    lines.push(`${prefix},status,${threshold.status}`);
    lines.push(`${prefix},hint,${csvEscape(threshold.hint)}`);
  }

  return lines.join("\n");
}

async function computeFunnelTotals(input: {
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
  const logWhere = and(
    eq(workoutLog.userId, userId),
    gte(workoutLog.createdAt, from),
    lte(workoutLog.createdAt, to),
    planId ? eq(workoutLog.planId, planId) : undefined,
  );

  const [generatedRows, logRows, setRows, extraLogRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(generatedSession).where(generatedWhere),
    db
      .select({
        savedLogs: sql<number>`count(*)`,
        savedLogsWithGeneratedSession: sql<number>`count(case when ${workoutLog.generatedSessionId} is not null then 1 end)`,
      })
      .from(workoutLog)
      .where(logWhere),
    db
      .select({
        totalSets: sql<number>`count(*)`,
        extraSets: sql<number>`count(case when ${workoutSet.isExtra} then 1 end)`,
      })
      .from(workoutLog)
      .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
      .where(logWhere),
    db
      .select({ count: sql<number>`count(distinct ${workoutSet.logId})` })
      .from(workoutLog)
      .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
      .where(and(logWhere, eq(workoutSet.isExtra, true))),
  ]);

  const generatedCount = Number(generatedRows[0]?.count ?? 0);
  const savedLogs = Number(logRows[0]?.savedLogs ?? 0);
  const totalSets = Number(setRows[0]?.totalSets ?? 0);

  return {
    generatedSessions: generatedCount,
    savedLogs,
    savedLogsWithGeneratedSession: Number(logRows[0]?.savedLogsWithGeneratedSession ?? 0),
    savedLogsWithExtraExercise: Number(extraLogRows[0]?.count ?? 0),
    totalSets,
    extraSets: Number(setRows[0]?.extraSets ?? 0),
    avgSetsPerLog: savedLogs > 0 ? Math.round((totalSets / savedLogs) * 100) / 100 : 0,
  };
}

async function computeUxSummary(input: { userId: string; from: Date; to: Date }) {
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
    rates: buildUxRates(summary),
  };
}

async function buildWindowSummary(input: {
  userId: string;
  days: number;
  anchorTo: Date;
  comparePrev: boolean;
}): Promise<UxSummaryWindow> {
  const to = new Date(input.anchorTo);
  const from = new Date(input.anchorTo);
  from.setDate(from.getDate() - input.days);

  const current = await computeUxSummary({ userId: input.userId, from, to });
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

  const rangeMs = Math.max(1, to.getTime() - from.getTime());
  if (input.comparePrev) {
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - rangeMs);
    const previousSummary = await computeUxSummary({
      userId: input.userId,
      from: prevFrom,
      to: prevTo,
    });
    previous = previousSummary;
    trend = {
      totalEventsDelta: current.totalEvents - previousSummary.totalEvents,
      opensDelta: current.summary.opens - previousSummary.summary.opens,
      modeChangesDelta: current.summary.modeChanges - previousSummary.summary.modeChanges,
      generateSuccessesDelta:
        current.summary.generateSuccesses - previousSummary.summary.generateSuccesses,
      saveSuccessesDelta: current.summary.saveSuccesses - previousSummary.summary.saveSuccesses,
      addExerciseAddsDelta: current.summary.addExerciseAdds - previousSummary.summary.addExerciseAdds,
      saveSuccessFromClicksDelta:
        current.rates.saveSuccessFromClicks - previousSummary.rates.saveSuccessFromClicks,
      saveSuccessFromOpensDelta:
        current.rates.saveSuccessFromOpens - previousSummary.rates.saveSuccessFromOpens,
    };
  }

  return {
    days: input.days,
    from: from.toISOString(),
    to: to.toISOString(),
    rangeDays: Math.max(1, Math.ceil(Math.max(1, to.getTime() - from.getTime()) / 86_400_000)),
    totalEvents: current.totalEvents,
    summary: current.summary,
    rates: current.rates,
    previous,
    trend,
  };
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 30);
    const planId = searchParams.get("planId")?.trim() || null;
    const comparePrev = searchParams.get("comparePrev") === "1";
    const windowDays = parseWindowDays(searchParams.get("windows"));
    const thresholdTargets = parseThresholdTargets(searchParams);
    const format = (searchParams.get("format") ?? "json").toLowerCase();

    if (format !== "json" && format !== "csv") {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 400 });
    }

    const cacheParams = {
      from: from.toISOString(),
      to: to.toISOString(),
      planId,
      comparePrev,
      windowDays: windowDays.join(","),
      thresholdTargets,
    };

    let payload = await getStatsCache<UxSnapshotPayload>({
      userId,
      metric: "ux_snapshot",
      params: cacheParams,
      maxAgeSeconds: 120,
    });

    if (!payload) {
      const totals = await computeFunnelTotals({ userId, from, to, planId });
      const steps = buildSteps(totals);
      const rates = buildFunnelRates(totals, rangeDays);
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
        const prevTotals = await computeFunnelTotals({ userId, from: prevFrom, to: prevTo, planId });
        const prevRates = buildFunnelRates(prevTotals, rangeDays);
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

      const funnel: UxFunnelSnapshot = {
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

      const windows = await Promise.all(
        windowDays.map((days) =>
          buildWindowSummary({
            userId,
            days,
            anchorTo: to,
            comparePrev,
          }),
        ),
      );

      payload = {
        exportedAt: new Date().toISOString(),
        filters: {
          from: from.toISOString(),
          to: to.toISOString(),
          rangeDays,
          planId,
          comparePrev,
          windowDays,
          thresholdTargets,
        },
        funnel,
        windows,
        thresholds: buildThresholds({
          funnel,
          windows,
          targets: thresholdTargets,
        }),
      };

      await setStatsCache({
        userId,
        metric: "ux_snapshot",
        params: cacheParams,
        payload,
      });
    }

    if (format === "csv") {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      return new Response(payloadToCsv(payload), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="workout-log-${userId}-ux-snapshot-${stamp}.csv"`,
          "cache-control": "no-store",
        },
      });
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
