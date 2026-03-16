"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { apiGet, isAbortError } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { MetricTile, SparklineChart } from "./_components/stats-dashboard-primitives";
import type { StatsFilterValues } from "./_components/stats-filters-sheet";
import { AccordionSection } from "@/components/ui/accordion-section";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import { Card } from "@/components/ui/card";

const StatsFiltersSheet = dynamic(() => import("./_components/stats-filters-sheet"), {
  ssr: false,
  loading: () => null,
});

type Plan = {
  id: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
};

type E1RMResp = {
  from: string;
  to: string;
  rangeDays: number;
  exercise: string;
  exerciseId?: string | null;
  best: { date: string; e1rm: number; weightKg: number; reps: number } | null;
  series: Array<{ date: string; e1rm: number; weightKg: number; reps: number }>;
};

type VolumeResp = {
  from: string;
  to: string;
  rangeDays: number;
  totals: { tonnage: number; reps: number; sets: number };
  previousTotals?: { tonnage: number; reps: number; sets: number };
  trend?: { tonnageDelta: number; repsDelta: number; setsDelta: number };
  byExercise: Array<{
    exerciseId?: string | null;
    exerciseName: string;
    tonnage: number;
    reps: number;
    sets: number;
  }>;
};

type VolumeSeriesResp = {
  from: string;
  to: string;
  rangeDays: number;
  bucket: "day" | "week" | "month";
  exerciseId?: string | null;
  exercise?: string | null;
  series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
  byExercise?: Array<{
    exerciseId: string | null;
    exerciseName: string;
    totals: { tonnage: number; reps: number; sets: number };
    series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
  }>;
};

type ComplianceResp = {
  from: string;
  to: string;
  rangeDays: number;
  planId: string | null;
  planned: number;
  done: number;
  compliance: number;
  byPlan: Array<{
    planId: string;
    planName: string;
    planned: number;
    done: number;
    compliance: number;
  }>;
  previous?: { planned: number; done: number; compliance: number };
  trend?: { complianceDelta: number; doneDelta: number };
};

type PRsResp = {
  from: string;
  to: string;
  rangeDays: number;
  items: Array<{
    exerciseId: string | null;
    exerciseName: string;
    best: { date: string; e1rm: number; weightKg: number; reps: number };
    latest: { date: string; e1rm: number; weightKg: number; reps: number };
    improvement: number;
  }>;
};

type UxFunnelResp = {
  from: string;
  to: string;
  rangeDays: number;
  planId: string | null;
  totals: {
    generatedSessions: number;
    savedLogs: number;
    savedLogsWithGeneratedSession: number;
    savedLogsWithExtraExercise: number;
    totalSets: number;
    extraSets: number;
    avgSetsPerLog: number;
  };
  steps: Array<{
    id: "generated_sessions" | "saved_logs" | "saved_logs_with_extra";
    label: string;
    count: number;
    conversionFromPrevious: number | null;
  }>;
  rates: {
    saveFromGenerate: number;
    extraFromSaved: number;
    generatedPerDay: number;
    savedPerDay: number;
  };
  dropoff: {
    fromStepId: string;
    toStepId: string;
    dropCount: number;
    dropRate: number;
  };
  previous?: {
    totals: {
      generatedSessions: number;
      savedLogs: number;
      savedLogsWithGeneratedSession: number;
      savedLogsWithExtraExercise: number;
      totalSets: number;
      extraSets: number;
      avgSetsPerLog: number;
    };
    rates: {
      saveFromGenerate: number;
      extraFromSaved: number;
      generatedPerDay: number;
      savedPerDay: number;
    };
  };
  trend?: {
    generatedSessionsDelta: number;
    savedLogsDelta: number;
    saveFromGenerateDelta: number;
    extraFromSavedDelta: number;
  };
};

type UxEventsSummaryResp = {
  from: string;
  to: string;
  rangeDays: number;
  totalEvents: number;
  summary: {
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
  rates: {
    saveSuccessFromClicks: number;
    generateSuccessFromClicks: number;
    addAfterSheetOpen: number;
    repeatSuccessFromClicks: number;
    saveSuccessFromOpens: number;
  };
  previous?: {
    totalEvents: number;
    summary: {
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
    rates: {
      saveSuccessFromClicks: number;
      generateSuccessFromClicks: number;
      addAfterSheetOpen: number;
      repeatSuccessFromClicks: number;
      saveSuccessFromOpens: number;
    };
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

type TrendWindow = {
  days: 7 | 30 | 90;
  volume: VolumeResp;
  compliance: ComplianceResp;
};

type UxSummaryWindow = {
  days: 1 | 7 | 14;
  payload: UxEventsSummaryResp;
};

type UxSnapshotResp = {
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
  funnel: UxFunnelResp;
  windows: UxSummaryWindow[];
  thresholds: Array<{
    id: string;
    label: string;
    value: number;
    target: number;
    status: "ok" | "warn";
    hint: string;
  }>;
};

type UxThresholdTargets = {
  saveFromGenerate: number;
  saveSuccessFromClicks7d: number;
  addAfterSheetOpen14d: number;
};

type UxCompareRow = {
  id: string;
  metric: string;
  current: string;
  previous: string;
  deltaText: string;
};

type MigrationTelemetryResp = {
  ts: string;
  status: "ok" | "warn" | "critical";
  reasons: string[];
  filters: {
    lookbackMinutes: number;
    limit: number;
    runStatus: "ALL" | "ISSUE" | "SUCCESS" | "RUNNING" | "LOCK_TIMEOUT" | "FAILED" | "SKIPPED";
    format: "json" | "csv";
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

const PRESET_RANGES: Array<7 | 30 | 90> = [7, 30, 90];
const MIGRATION_LOOKBACK_PRESETS = [120, 720, 1440, 4320] as const;
const DEFAULT_UX_THRESHOLD_TARGETS: UxThresholdTargets = {
  saveFromGenerate: 0.65,
  saveSuccessFromClicks7d: 0.6,
  addAfterSheetOpen14d: 0.35,
};

function toQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgoDateOnly(daysAgo: number) {
  const safeDaysAgo = Math.max(0, Math.floor(daysAgo));
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - safeDaysAgo);
  return d.toISOString().slice(0, 10);
}

function formatKg(v: number) {
  return `${Math.round(v).toLocaleString()} kg`;
}

function formatRatioPercent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatInteger(value: number) {
  return Math.round(value).toLocaleString();
}

function formatLookbackLabel(minutes: number) {
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}일`;
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  return `${minutes}분`;
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function describeMigrationReason(reason: string) {
  if (reason === "pending_migrations") return "적용되지 않은 마이그레이션이 존재합니다.";
  if (reason === "telemetry_table_missing") return "migration_run_log 테이블이 아직 생성되지 않았습니다.";
  if (reason === "lock_timeout_recent") return "최근 잠금 대기 타임아웃이 감지되었습니다.";
  if (reason === "migration_failed_recent") return "최근 마이그레이션 실패가 감지되었습니다.";
  if (reason === "migration_skipped_recent") return "최근 마이그레이션이 skip 처리되었습니다.";
  if (reason === "lock_wait_high_recent") return "최근 잠금 대기 시간이 높았습니다.";
  return reason;
}

function describeMigrationRunStatus(status: string) {
  if (status === "SUCCESS") return "성공";
  if (status === "RUNNING") return "실행 중";
  if (status === "LOCK_TIMEOUT") return "락 타임아웃";
  if (status === "FAILED") return "실패";
  if (status === "SKIPPED") return "건너뜀";
  return status;
}

function migrationRunStatusLabelClassName(status: string) {
  if (status === "SUCCESS") return "label label-complete label-sm";
  if (status === "RUNNING") return "label label-program label-sm";
  if (status === "LOCK_TIMEOUT") return "label label-danger label-sm";
  if (status === "FAILED") return "label label-danger label-sm";
  if (status === "SKIPPED") return "label label-warning label-sm";
  return "label label-note label-sm";
}

function isMigrationTelemetryResp(value: unknown): value is MigrationTelemetryResp {
  if (!value || typeof value !== "object") return false;
  const asRecord = value as Record<string, unknown>;
  return (
    typeof asRecord.status === "string" &&
    Array.isArray(asRecord.reasons) &&
    typeof asRecord.checks === "object" &&
    asRecord.checks !== null
  );
}

function clampRatio(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0.05, Math.min(0.99, value));
}

function trendMeta(delta: number, digits = 1) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
    return { arrow: "→", tone: "flat" as const, value: "0" };
  }
  if (delta > 0) {
    return {
      arrow: "↑",
      tone: "up" as const,
      value: `+${delta.toFixed(digits)}`,
    };
  }
  return {
    arrow: "↓",
    tone: "down" as const,
    value: delta.toFixed(digits),
  };
}

function createDefaultStatsFilters(): StatsFilterValues {
  return {
    planId: "",
    bucket: "week",
    from: "",
    to: todayDateOnly(),
    exerciseId: "",
    exercise: "Back Squat",
  };
}

export default function StatsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planId, setPlanId] = useState("");

  const [exerciseId, setExerciseId] = useState("");
  const [exercise, setExercise] = useState("Back Squat");

  const [days, setDays] = useState(90);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayDateOnly());
  const [bucket, setBucket] = useState<"day" | "week" | "month">("week");

  const [loading, setLoading] = useState(false);
  const [coreLoadKey, setCoreLoadKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsLoadKey, setDetailsLoadKey] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  const [e1rm, setE1rm] = useState<E1RMResp | null>(null);
  const [volume, setVolume] = useState<VolumeResp | null>(null);
  const [series, setSeries] = useState<VolumeSeriesResp | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResp | null>(null);
  const [prs, setPrs] = useState<PRsResp | null>(null);
  const [uxFunnel, setUxFunnel] = useState<UxFunnelResp | null>(null);
  const [uxSnapshot, setUxSnapshot] = useState<UxSnapshotResp | null>(null);
  const [uxSummaryWindows, setUxSummaryWindows] = useState<UxSummaryWindow[]>([]);
  const [migrationTelemetry, setMigrationTelemetry] = useState<MigrationTelemetryResp | null>(null);
  const [migrationTelemetryLoading, setMigrationTelemetryLoading] = useState(false);
  const [migrationLoadKey, setMigrationLoadKey] = useState<string | null>(null);
  const [migrationLookbackMinutes, setMigrationLookbackMinutes] = useState<number>(720);
  const [migrationRunStatusFilter, setMigrationRunStatusFilter] = useState<"ALL" | "ISSUE">("ALL");
  const [settingsSnapshot, setSettingsSnapshot] = useState<
    Record<string, string | number | boolean | null>
  >({});
  const [uxThresholdTargets, setUxThresholdTargets] = useState<UxThresholdTargets>(
    DEFAULT_UX_THRESHOLD_TARGETS,
  );
  const [uxCompareMode, setUxCompareMode] = useState(false);
  const [trendWindows, setTrendWindows] = useState<TrendWindow[]>([]);
  const [rangeIndex, setRangeIndex] = useState(2);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shouldRenderFiltersSheet, setShouldRenderFiltersSheet] = useState(false);
  const [deferredDetailsReady, setDeferredDetailsReady] = useState(false);
  const [deferredBackgroundReady, setDeferredBackgroundReady] = useState(false);
  const swipeStartX = useRef<number | null>(null);

  const rangeQuery = useMemo(() => {
    if (from) {
      return {
        from,
        to: to || todayDateOnly(),
      };
    }
    return {
      days,
    };
  }, [days, from, to]);
  const isCoreSettled = useQuerySettled(coreLoadKey, loading);
  const isDetailsSettled = useQuerySettled(detailsLoadKey, detailsLoading);
  const isMigrationSettled = useQuerySettled(migrationLoadKey, migrationTelemetryLoading);
  const canShowCoreEmptyState = isCoreSettled && !loading && !error;
  const canShowDetailsEmptyState = isDetailsSettled && !detailsLoading && !detailsError;
  const canShowMigrationEmptyState = isMigrationSettled && !migrationTelemetryLoading;

  useEffect(() => {
    if (typeof window === "undefined") {
      setDeferredDetailsReady(true);
      setDeferredBackgroundReady(true);
      return;
    }

    const detailsTimer = window.setTimeout(() => setDeferredDetailsReady(true), 140);
    const backgroundTimer = window.setTimeout(() => setDeferredBackgroundReady(true), 700);
    return () => {
      window.clearTimeout(detailsTimer);
      window.clearTimeout(backgroundTimer);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        setPlansLoading(true);
        const res = await apiGet<{ items: Plan[] }>("/api/plans", { signal: controller.signal });
        if (cancelled) return;
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return "";
        });
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await fetchSettingsSnapshot(controller.signal);
        if (cancelled) return;
        setSettingsSnapshot(snapshot);
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        if (!cancelled) {
          setSettingsSnapshot({});
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const globalTargets: UxThresholdTargets = {
      saveFromGenerate: clampRatio(
        Number(settingsSnapshot["prefs.uxThreshold.saveFromGenerate"]),
        DEFAULT_UX_THRESHOLD_TARGETS.saveFromGenerate,
      ),
      saveSuccessFromClicks7d: clampRatio(
        Number(settingsSnapshot["prefs.uxThreshold.saveSuccessFromClicks7d"]),
        DEFAULT_UX_THRESHOLD_TARGETS.saveSuccessFromClicks7d,
      ),
      addAfterSheetOpen14d: clampRatio(
        Number(settingsSnapshot["prefs.uxThreshold.addAfterSheetOpen14d"]),
        DEFAULT_UX_THRESHOLD_TARGETS.addAfterSheetOpen14d,
      ),
    };

    if (!planId) {
      setUxThresholdTargets(globalTargets);
      return;
    }

    const byPlanTargets: UxThresholdTargets = {
      saveFromGenerate: clampRatio(
        Number(settingsSnapshot[`prefs.uxThreshold.plan.${planId}.saveFromGenerate`]),
        globalTargets.saveFromGenerate,
      ),
      saveSuccessFromClicks7d: clampRatio(
        Number(settingsSnapshot[`prefs.uxThreshold.plan.${planId}.saveSuccessFromClicks7d`]),
        globalTargets.saveSuccessFromClicks7d,
      ),
      addAfterSheetOpen14d: clampRatio(
        Number(settingsSnapshot[`prefs.uxThreshold.plan.${planId}.addAfterSheetOpen14d`]),
        globalTargets.addAfterSheetOpen14d,
      ),
    };

    setUxThresholdTargets(byPlanTargets);
  }, [planId, settingsSnapshot]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setCoreLoadKey(`stats-dashboard:core:${Date.now()}`);
        setError(null);

        const e1rmPath = `/api/stats/e1rm?${toQuery({
          ...rangeQuery,
          exerciseId: exerciseId || undefined,
          exercise: exerciseId ? undefined : exercise,
        })}`;

        const volumePath = `/api/stats/volume?${toQuery({
          ...rangeQuery,
          comparePrev: 1,
        })}`;

        const compliancePath = `/api/stats/compliance?${toQuery({
          ...rangeQuery,
          planId: planId || undefined,
          comparePrev: 1,
        })}`;
        const [e1rmRes, volRes, compRes] = await Promise.all([
          apiGet<E1RMResp>(e1rmPath, { signal: controller.signal }),
          apiGet<VolumeResp>(volumePath, { signal: controller.signal }),
          apiGet<ComplianceResp>(compliancePath, { signal: controller.signal }),
        ]);

        if (cancelled) return;
        setE1rm(e1rmRes);
        setVolume(volRes);
        setCompliance(compRes);
      } catch (e: unknown) {
        if (cancelled || isAbortError(e)) return;
        setError(e instanceof Error ? e.message : "통계 데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [exercise, exerciseId, planId, rangeQuery, refreshTick]);

  useEffect(() => {
    if (!deferredDetailsReady) return;
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        setDetailsLoading(true);
        setDetailsLoadKey(`stats-dashboard:details:${Date.now()}`);
        setDetailsError(null);

        const seriesPath = `/api/stats/volume-series?${toQuery({
          ...rangeQuery,
          exerciseId: exerciseId || undefined,
          exercise: exerciseId ? undefined : exercise,
          bucket,
          perExercise: 1,
          maxExercises: 8,
        })}`;

        const prsPath = `/api/stats/prs?${toQuery({
          ...rangeQuery,
          limit: 20,
        })}`;

        const uxSnapshotPath = `/api/stats/ux-snapshot?${toQuery({
          ...rangeQuery,
          planId: planId || undefined,
          comparePrev: 1,
          windows: "1,7,14",
          targetSaveFromGenerate: uxThresholdTargets.saveFromGenerate,
          targetSaveSuccessFromClicks7d: uxThresholdTargets.saveSuccessFromClicks7d,
          targetAddAfterSheetOpen14d: uxThresholdTargets.addAfterSheetOpen14d,
        })}`;

        const [seriesRes, prsRes, uxSnapshotRes] = await Promise.all([
          apiGet<VolumeSeriesResp>(seriesPath, { signal: controller.signal }),
          apiGet<PRsResp>(prsPath, { signal: controller.signal }),
          apiGet<UxSnapshotResp>(uxSnapshotPath, { signal: controller.signal }),
        ]);

        if (cancelled) return;
        setSeries(seriesRes);
        setPrs(prsRes);
        setUxSnapshot(uxSnapshotRes);
        setUxFunnel(uxSnapshotRes.funnel);
        setUxSummaryWindows(uxSnapshotRes.windows);
      } catch (e: unknown) {
        if (cancelled || isAbortError(e)) return;
        setDetailsError(e instanceof Error ? e.message : "상세 통계 데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    bucket,
    deferredDetailsReady,
    exercise,
    exerciseId,
    planId,
    rangeQuery,
    refreshTick,
    uxThresholdTargets.addAfterSheetOpen14d,
    uxThresholdTargets.saveFromGenerate,
    uxThresholdTargets.saveSuccessFromClicks7d,
  ]);

  useEffect(() => {
    if (!deferredBackgroundReady) return;
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        setTrendLoading(true);
        const trendDays: Array<7 | 30 | 90> = [7, 30, 90];
        const trendCalls = trendDays.map(async (d) => {
          const [v, c] = await Promise.all([
            apiGet<VolumeResp>(`/api/stats/volume?${toQuery({ days: d, comparePrev: 1 })}`, {
              signal: controller.signal,
            }),
            apiGet<ComplianceResp>(
              `/api/stats/compliance?${toQuery({
                days: d,
                planId: planId || undefined,
                comparePrev: 1,
              })}`,
              { signal: controller.signal },
            ),
          ]);
          return { days: d, volume: v, compliance: c } satisfies TrendWindow;
        });

        const trendRes = await Promise.all(trendCalls);
        if (cancelled) return;
        setTrendWindows(trendRes);
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        if (!cancelled) setTrendWindows([]);
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deferredBackgroundReady, planId, refreshTick]);

  useEffect(() => {
    if (!deferredBackgroundReady) return;
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      setMigrationTelemetryLoading(true);
      setMigrationLoadKey(`stats-dashboard:migration:${Date.now()}`);
      const path = `/api/stats/migration-telemetry?${toQuery({
        lookbackMinutes: migrationLookbackMinutes,
        limit: 20,
        runStatus: migrationRunStatusFilter === "ALL" ? undefined : migrationRunStatusFilter,
      })}`;
      try {
        const body = await apiGet<unknown>(path, { signal: controller.signal });
        if (cancelled) return;
        if (isMigrationTelemetryResp(body)) {
          setMigrationTelemetry(body);
        } else {
          setMigrationTelemetry(null);
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        if (!cancelled) setMigrationTelemetry(null);
      } finally {
        if (!cancelled) setMigrationTelemetryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deferredBackgroundReady, migrationLookbackMinutes, migrationRunStatusFilter, refreshTick]);

  const seriesPoints = useMemo(
    () => (series ? series.series.map((p) => Number(p.tonnage ?? 0)) : []),
    [series],
  );
  const seriesLabels = useMemo(
    () => (series ? series.series.map((p) => p.period) : []),
    [series],
  );

  const selectedPlanName = useMemo(() => plans.find((p) => p.id === planId)?.name ?? null, [plans, planId]);
  const activePresetDays = PRESET_RANGES[rangeIndex];
  const rangeHeadline = from ? `${from} → ${to || todayDateOnly()}` : `${activePresetDays}일`;
  const filterValues = useMemo<StatsFilterValues>(
    () => ({
      planId,
      bucket,
      from,
      to,
      exerciseId,
      exercise,
    }),
    [bucket, exercise, exerciseId, from, planId, to],
  );
  const activeTrend = useMemo(
    () => (from ? null : trendWindows.find((t) => t.days === activePresetDays) ?? null),
    [activePresetDays, from, trendWindows],
  );
  const activeVolumeTrend = trendMeta(activeTrend?.volume.trend?.tonnageDelta ?? 0, 0);
  const activeComplianceTrend = trendMeta((activeTrend?.compliance.trend?.complianceDelta ?? 0) * 100, 1);
  const volumeTrend = trendMeta(volume?.trend?.tonnageDelta ?? 0, 0);
  const complianceTrend = trendMeta((compliance?.trend?.complianceDelta ?? 0) * 100, 1);
  const uxSaveTrend = trendMeta((uxFunnel?.trend?.saveFromGenerateDelta ?? 0) * 100, 1);
  const uxExtraTrend = trendMeta((uxFunnel?.trend?.extraFromSavedDelta ?? 0) * 100, 1);
  const uxFunnelCsvHref = useMemo(
    () =>
      `/api/stats/ux-funnel?${toQuery({
        ...rangeQuery,
        planId: planId || undefined,
        comparePrev: 1,
        format: "csv",
      })}`,
    [planId, rangeQuery],
  );
  const uxSnapshotJsonHref = useMemo(
    () =>
      `/api/stats/ux-snapshot?${toQuery({
        ...rangeQuery,
        planId: planId || undefined,
        comparePrev: 1,
        windows: "1,7,14",
        targetSaveFromGenerate: uxThresholdTargets.saveFromGenerate,
        targetSaveSuccessFromClicks7d: uxThresholdTargets.saveSuccessFromClicks7d,
        targetAddAfterSheetOpen14d: uxThresholdTargets.addAfterSheetOpen14d,
        format: "json",
      })}`,
    [
      planId,
      rangeQuery,
      uxThresholdTargets.addAfterSheetOpen14d,
      uxThresholdTargets.saveFromGenerate,
      uxThresholdTargets.saveSuccessFromClicks7d,
    ],
  );
  const uxSnapshotCsvHref = useMemo(
    () =>
      `/api/stats/ux-snapshot?${toQuery({
        ...rangeQuery,
        planId: planId || undefined,
        comparePrev: 1,
        windows: "1,7,14",
        targetSaveFromGenerate: uxThresholdTargets.saveFromGenerate,
        targetSaveSuccessFromClicks7d: uxThresholdTargets.saveSuccessFromClicks7d,
        targetAddAfterSheetOpen14d: uxThresholdTargets.addAfterSheetOpen14d,
        format: "csv",
      })}`,
    [
      planId,
      rangeQuery,
      uxThresholdTargets.addAfterSheetOpen14d,
      uxThresholdTargets.saveFromGenerate,
      uxThresholdTargets.saveSuccessFromClicks7d,
    ],
  );
  const migrationTelemetryJsonHref = useMemo(
    () =>
      `/api/stats/migration-telemetry?${toQuery({
        lookbackMinutes: migrationLookbackMinutes,
        limit: 200,
        runStatus: migrationRunStatusFilter === "ALL" ? undefined : migrationRunStatusFilter,
      })}`,
    [migrationLookbackMinutes, migrationRunStatusFilter],
  );
  const migrationTelemetryCsvHref = useMemo(
    () =>
      `/api/stats/migration-telemetry?${toQuery({
        lookbackMinutes: migrationLookbackMinutes,
        limit: 200,
        runStatus: migrationRunStatusFilter === "ALL" ? undefined : migrationRunStatusFilter,
        format: "csv",
      })}`,
    [migrationLookbackMinutes, migrationRunStatusFilter],
  );
  const uxSummaryCards = useMemo(() => {
    const days: Array<1 | 7 | 14> = [1, 7, 14];
    return days.map((dayValue) => ({
      days: dayValue,
      window: uxSummaryWindows.find((item) => item.days === dayValue) ?? null,
    }));
  }, [uxSummaryWindows]);
  const activeUxPreset = useMemo(() => {
    if (!from) return null;
    const today = todayDateOnly();
    if ((to || today) !== today) return null;
    for (const candidate of [1, 7, 14] as const) {
      if (from === dateDaysAgoDateOnly(candidate - 1)) return candidate;
    }
    return null;
  }, [from, to]);
  const migrationStatusMeta = useMemo(() => {
    if (!migrationTelemetry) {
      return {
        label: "확인 불가",
        className: "label label-note",
      };
    }
    if (migrationTelemetry.status === "critical") {
      return {
        label: "위험",
        className: "label label-failed",
      };
    }
    if (migrationTelemetry.status === "warn") {
      return {
        label: "주의",
        className: "label label-warning",
      };
    }
    return {
      label: "정상",
      className: "label label-complete",
    };
  }, [migrationTelemetry]);
  const recentMigrationRuns = migrationTelemetry?.checks.telemetry.recentRuns ?? [];
  const uxThresholds = uxSnapshot?.thresholds ?? [];
  const uxCompareRows = useMemo<UxCompareRow[]>(() => {
    if (!uxSnapshot?.funnel.previous) return [];

    const rows: UxCompareRow[] = [];
    const addCountRow = (id: string, metric: string, current: number, previous: number) => {
      const delta = current - previous;
      const trend = trendMeta(delta, 0);
      rows.push({
        id,
        metric,
        current: formatInteger(current),
        previous: formatInteger(previous),
        deltaText: `${trend.arrow} ${trend.value}`,
      });
    };

    const addRateRow = (id: string, metric: string, current: number, previous: number) => {
      const deltaPp = (current - previous) * 100;
      const trend = trendMeta(deltaPp, 1);
      rows.push({
        id,
        metric,
        current: formatRatioPercent(current, 1),
        previous: formatRatioPercent(previous, 1),
        deltaText: `${trend.arrow} ${trend.value}pp`,
      });
    };

    const funnelCurrent = uxSnapshot.funnel;
    const funnelPrevious = uxSnapshot.funnel.previous;
    addCountRow(
      "funnel-generated",
      "퍼널: 생성 세션",
      funnelCurrent.totals.generatedSessions,
      funnelPrevious.totals.generatedSessions,
    );
    addCountRow(
      "funnel-saved",
      "퍼널: 저장 로그",
      funnelCurrent.totals.savedLogs,
      funnelPrevious.totals.savedLogs,
    );
    addRateRow(
      "funnel-save-rate",
      "퍼널: 생성→저장 전환율",
      funnelCurrent.rates.saveFromGenerate,
      funnelPrevious.rates.saveFromGenerate,
    );
    addRateRow(
      "funnel-extra-rate",
      "퍼널: 저장→추가운동 전환율",
      funnelCurrent.rates.extraFromSaved,
      funnelPrevious.rates.extraFromSaved,
    );

    const sevenDay = uxSummaryWindows.find((window) => window.days === 7)?.payload;
    if (sevenDay?.previous) {
      addCountRow(
        "window7-save-success",
        "7일: 저장 성공 수",
        sevenDay.summary.saveSuccesses,
        sevenDay.previous.summary.saveSuccesses,
      );
      addRateRow(
        "window7-save-click-rate",
        "7일: 저장 클릭→성공율",
        sevenDay.rates.saveSuccessFromClicks,
        sevenDay.previous.rates.saveSuccessFromClicks,
      );
    }

    const fourteenDay = uxSummaryWindows.find((window) => window.days === 14)?.payload;
    if (fourteenDay?.previous) {
      addCountRow(
        "window14-add-count",
        "14일: 운동 추가 수",
        fourteenDay.summary.addExerciseAdds,
        fourteenDay.previous.summary.addExerciseAdds,
      );
      addRateRow(
        "window14-add-rate",
        "14일: 시트 오픈→운동 추가율",
        fourteenDay.rates.addAfterSheetOpen,
        fourteenDay.previous.rates.addAfterSheetOpen,
      );
    }

    return rows;
  }, [uxSnapshot, uxSummaryWindows]);
  const refreshStatsPage = useCallback(async () => {
    setRefreshTick((prev) => prev + 1);
  }, []);
  const pullToRefresh = usePullToRefresh({
    onRefresh: refreshStatsPage,
    triggerSelector: "[data-pull-refresh-trigger]",
  });

  useEffect(() => {
    if (from) return;
    const idx = PRESET_RANGES.indexOf(days as 7 | 30 | 90);
    if (idx >= 0) setRangeIndex(idx);
  }, [days, from]);

  function setPresetRange(next: 7 | 30 | 90) {
    setFrom("");
    setDays(next);
  }

  function applyUxFocusPreset(windowDays: 1 | 7 | 14) {
    const toDate = todayDateOnly();
    const fromDate = dateDaysAgoDateOnly(windowDays - 1);
    setFrom(fromDate);
    setTo(toDate);
    setBucket("day");
  }

  const resetFilters = useCallback(() => {
    const defaults = createDefaultStatsFilters();
    setPlanId(defaults.planId);
    setExerciseId(defaults.exerciseId);
    setExercise(defaults.exercise);
    setFrom(defaults.from);
    setTo(defaults.to);
    setBucket(defaults.bucket);
    setRangeIndex(2);
    setDays(90);
  }, []);

  const applyFilters = useCallback((next: StatsFilterValues) => {
    setPlanId(next.planId);
    setBucket(next.bucket);
    setFrom(next.from);
    setTo(next.to);
    setExerciseId(next.exerciseId);
    setExercise(next.exercise);
  }, []);

  function openFiltersSheet() {
    setShouldRenderFiltersSheet(true);
    setFiltersOpen(true);
  }

  function onRangeSwipeStart(e: React.TouchEvent<HTMLDivElement>) {
    swipeStartX.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onRangeSwipeEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (swipeStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? swipeStartX.current;
    const delta = endX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 36) return;

    const direction = delta < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(PRESET_RANGES.length - 1, rangeIndex + direction));
    if (nextIndex === rangeIndex) return;

    setRangeIndex(nextIndex);
    setPresetRange(PRESET_RANGES[nextIndex]);
  }

  return (
    <div
      {...pullToRefresh.bind}
    >
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
        refreshingLabel="통계 새로고침 중..."
        completeLabel="통계 갱신 완료"
      />

      <Card as="section" data-pull-refresh-trigger="true">
        <div>기본 흐름</div>
        <div>
          {PRESET_RANGES.map((d, idx) => (
            <button
              key={`core-${d}`}
              onClick={() => {
                setRangeIndex(idx);
                setPresetRange(d);
              }}
            >
              {d}일
            </button>
          ))}
          <button onClick={openFiltersSheet}>
            필터
          </button>
        </div>
        <div>
          <div>UX 분석 프리셋</div>
          <div>
            {([1, 7, 14] as const).map((windowDays) => (
              <button
                key={`ux-preset-${windowDays}`}
                onClick={() => applyUxFocusPreset(windowDays)}
              >
                {windowDays === 1 ? "오늘" : `${windowDays}일`}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card as="section">
        <div>
          <div>
            <div>활성 필터</div>
          </div>
          <button onClick={openFiltersSheet}>
            수정
          </button>
        </div>
        <div>
          <div>플랜: {selectedPlanName ?? "전체 플랜"}</div>
          <div>집계 단위: {bucket}</div>
          <div>범위: {from ? `${from} → ${to || todayDateOnly()}` : `${days}일`}</div>
          <div>운동: {exerciseId || exercise || "—"}</div>
        </div>
        <LoadingStateRows
          active={plansLoading || loading}
          label="불러오는 중"
          description="통계 지표를 계산하고 있습니다."
        />
        <ErrorStateRows
          message={error}
          onRetry={() => {
            setError(null);
            setRefreshTick((prev) => prev + 1);
          }}
        />
        <LoadingStateRows
          active={detailsLoading || trendLoading}
          delayMs={120}
          label="세부 분석 준비 중"
          description="UX/추세/PR 데이터를 이어서 불러오고 있습니다."
        />
        <ErrorStateRows
          title="세부 분석 일부 로드 실패"
          message={detailsError}
          onRetry={() => {
            setDetailsError(null);
            setRefreshTick((prev) => prev + 1);
          }}
        />
      </Card>

      <Card
        as="section"
        onTouchStart={onRangeSwipeStart}
        onTouchEnd={onRangeSwipeEnd}
      >
        <div>
          <div>
            <div>범위</div>
            <div>{rangeHeadline}</div>
          </div>
        </div>

        <div>
          {PRESET_RANGES.map((d, idx) => (
            <button
              key={d}
              onClick={() => {
                setRangeIndex(idx);
                setPresetRange(d);
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        <div>
          <div>
            <div>볼륨 ({activePresetDays}d)</div>
            <div>{activeTrend ? formatKg(activeTrend.volume.totals.tonnage) : "—"}</div>
            {activeTrend ? (
              <div>
                {activeVolumeTrend.arrow} {activeVolumeTrend.value}
              </div>
            ) : null}
          </div>
          <div>
            <div>준수율 ({activePresetDays}d)</div>
            <div>
              {activeTrend ? `${Math.round(activeTrend.compliance.compliance * 100)}%` : "—"}
            </div>
            {activeTrend ? (
              <div>
                {activeComplianceTrend.arrow} {activeComplianceTrend.value}pp
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <section>
        <MetricTile
          label="e1RM"
          value={e1rm?.best ? `${e1rm.best.e1rm} kg` : "—"}
          tone="1rm"
        />
        <MetricTile
          label="볼륨"
          value={volume ? formatKg(volume.totals.tonnage) : "—"}
          tone="volume"
          trend={
            volume
              ? {
                  text: `${volumeTrend.arrow} ${volumeTrend.value}`,
                  tone: volumeTrend.tone,
                }
              : undefined
          }
        />
        <MetricTile
          label="준수율"
          value={compliance ? `${Math.round(compliance.compliance * 100)}%` : "—"}
          tone="progress"
          trend={
            compliance
              ? {
                  text: `${complianceTrend.arrow} ${complianceTrend.value}pp`,
                  tone: complianceTrend.tone,
                }
              : undefined
          }
        />
      </section>

      <Card as="section">
        <div>
          <div>
            <div>운영 마이그레이션 상태</div>
          </div>
          <div>
            <span>
              {migrationStatusMeta.label}
            </span>
            <a href={migrationTelemetryJsonHref}>
              JSON
            </a>
            <a href={migrationTelemetryCsvHref}>
              CSV
            </a>
          </div>
        </div>

        <div>
          <div>조회 구간 / 실행 필터</div>
          <div>
            {MIGRATION_LOOKBACK_PRESETS.map((presetMinutes) => (
              <button
                key={`migration-lookback-${presetMinutes}`}
                type="button"
                onClick={() => setMigrationLookbackMinutes(presetMinutes)}
              >
                {formatLookbackLabel(presetMinutes)}
              </button>
            ))}
          </div>
          <div>
            <button
              type="button"
              onClick={() =>
                setMigrationRunStatusFilter((prev) => (prev === "ISSUE" ? "ALL" : "ISSUE"))
              }
            >
              문제 상태만 {migrationRunStatusFilter === "ISSUE" ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <LoadingStateRows
          active={migrationTelemetryLoading}
          label="불러오는 중"
          description="마이그레이션 텔레메트리 상태를 갱신하고 있습니다."
        />

        {migrationTelemetry ? (
          <>
            <div>
              <div>
                <div>마이그레이션 파일/적용</div>
                <div>
                  {migrationTelemetry.checks.migrations.appliedCount} /{" "}
                  {migrationTelemetry.checks.migrations.localCount}
                </div>
                <div>
                  pending {migrationTelemetry.checks.migrations.pending}
                </div>
              </div>
              <div>
                <div>
                  최근 {migrationTelemetry.checks.telemetry.lookbackMinutes}분 경고
                </div>
                <div>
                  <div>
                    timeout {migrationTelemetry.checks.telemetry.alerts.lockTimeoutCount}
                  </div>
                  <div>
                    failed {migrationTelemetry.checks.telemetry.alerts.failedCount}
                  </div>
                  <div>
                    skipped {migrationTelemetry.checks.telemetry.alerts.skippedCount}
                  </div>
                </div>
              </div>
              <div>
                <div>잠금 대기(ms)</div>
                <div>
                  avg {formatInteger(migrationTelemetry.checks.telemetry.alerts.avgLockWaitMs)}
                </div>
                <div>
                  max {formatInteger(migrationTelemetry.checks.telemetry.alerts.maxLockWaitMs)}
                </div>
              </div>
            </div>

            <div>
              <div>최근 적용: {formatDateTimeLocal(migrationTelemetry.checks.migrations.latestAppliedAt)}</div>
              <div>
                최신 해시:{" "}
                {migrationTelemetry.checks.migrations.latestAppliedHash
                  ? migrationTelemetry.checks.migrations.latestAppliedHash.slice(0, 12)
                  : "—"}
              </div>
              <div>
                최근 실패 시각: {formatDateTimeLocal(migrationTelemetry.checks.telemetry.alerts.latestFailureAt)}
              </div>
            </div>

            {migrationTelemetry.reasons.length > 0 ? (
              <div>
                {migrationTelemetry.reasons.map((reason) => describeMigrationReason(reason)).join(" · ")}
              </div>
            ) : null}

            {recentMigrationRuns.length > 0 ? (
              <div>
                <div>
                  실행 기록 {recentMigrationRuns.length}건 · 필터{" "}
                  {migrationRunStatusFilter === "ISSUE" ? "문제 상태만" : "전체 상태"}
                </div>
                <div>
                <table>
                  <thead>
                    <tr>
                      <th>시각</th>
                      <th>상태</th>
                      <th>러너</th>
                      <th>Lock(ms)</th>
                      <th>코드/메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMigrationRuns.map((run) => (
                      <tr key={run.runId}>
                        <td>{formatDateTimeLocal(run.startedAt)}</td>
                        <td>
                          <span className={migrationRunStatusLabelClassName(run.status)}>
                            {describeMigrationRunStatus(run.status)}
                          </span>
                        </td>
                        <td>{run.runner}</td>
                        <td>{formatInteger(run.lockWaitMs)}</td>
                        <td>
                          {run.errorCode ? `[${run.errorCode}] ` : ""}
                          {run.message ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : (
              <EmptyStateRows
                when={canShowMigrationEmptyState}
                label="실행 기록 없음"
                description={
                  migrationRunStatusFilter === "ISSUE"
                    ? "선택한 구간에 문제 상태 실행 기록이 없습니다."
                    : "migration_run_log에 최근 실행 기록이 없습니다."
                }
              />
            )}
          </>
        ) : canShowMigrationEmptyState ? (
          <EmptyStateRows
            when
            label="운영 상태 로드 실패"
            description="마이그레이션 텔레메트리 응답이 없어 기본 통계만 표시합니다."
          />
        ) : null}
      </Card>

      <Card as="section">
        <div>
          <div>
            <div>UX 퍼널 (서버 집계)</div>
          </div>
          <a href={uxFunnelCsvHref}>
            CSV 내보내기
          </a>
        </div>

        {uxFunnel ? (
          <>
            <div>
              {uxFunnel.steps.map((step) => (
                <article key={step.id}>
                  <div>{step.label}</div>
                  <div>{step.count.toLocaleString()}</div>
                  <div>
                    {step.conversionFromPrevious === null
                      ? "기준 단계"
                      : `이전 단계 대비 ${Math.round(step.conversionFromPrevious * 100)}%`}
                  </div>
                </article>
              ))}
            </div>

            <div>
              <div>
                <div>생성→저장</div>
                <div>{Math.round(uxFunnel.rates.saveFromGenerate * 100)}%</div>
                <div>
                  {uxSaveTrend.arrow} {uxSaveTrend.value}pp
                </div>
              </div>
              <div>
                <div>저장→추가운동</div>
                <div>{Math.round(uxFunnel.rates.extraFromSaved * 100)}%</div>
                <div>
                  {uxExtraTrend.arrow} {uxExtraTrend.value}pp
                </div>
              </div>
              <div>
                <div>일평균 생성</div>
                <div>{uxFunnel.rates.generatedPerDay}</div>
              </div>
              <div>
                <div>일평균 저장</div>
                <div>{uxFunnel.rates.savedPerDay}</div>
              </div>
            </div>

            <div>
              가장 큰 이탈 구간: <strong>{uxFunnel.dropoff.fromStepId}</strong> →{" "}
              <strong>{uxFunnel.dropoff.toStepId}</strong> ({uxFunnel.dropoff.dropCount}건,{" "}
              {Math.round(uxFunnel.dropoff.dropRate * 100)}%)
            </div>
          </>
        ) : (
          <EmptyStateRows
            when={canShowDetailsEmptyState}
            label="설정 값 없음"
            description="선택한 조건에서 UX 퍼널 데이터를 집계하지 못했습니다."
          />
        )}
      </Card>

      <Card as="section">
        <div>
          <div>
            <div>UX 행동 요약 (오늘/7일/14일)</div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setUxCompareMode((prev) => !prev)}
            >
              {uxCompareMode ? "비교 모드 숨기기" : "비교 모드"}
            </button>
            <a
              href="/settings/ux-thresholds"
            >
              기준치 설정
            </a>
            <a
              href={uxSnapshotJsonHref}
            >
              스냅샷 JSON
            </a>
            <a
              href={uxSnapshotCsvHref}
            >
              스냅샷 CSV
            </a>
          </div>
        </div>

        <div>
          {uxSummaryCards.map(({ days: windowDays, window }) => {
            const label = windowDays === 1 ? "오늘" : `${windowDays}일`;
            if (!window) {
              return (
                <article key={`ux-summary-${windowDays}`}>
                  <div>{label}</div>
                  <div>요약 데이터 로드 중...</div>
                </article>
              );
            }

            const saveRateTrend = trendMeta((window.payload.trend?.saveSuccessFromClicksDelta ?? 0) * 100, 1);
            const saveCountTrend = trendMeta(window.payload.trend?.saveSuccessesDelta ?? 0, 0);

            return (
              <article key={`ux-summary-${windowDays}`}>
                <div>
                  <div>{label}</div>
                  <div>이벤트 {window.payload.totalEvents.toLocaleString()}</div>
                </div>

                <div>
                  <div>오픈 {window.payload.summary.opens}</div>
                  <div>생성성공 {window.payload.summary.generateSuccesses}</div>
                  <div>저장성공 {window.payload.summary.saveSuccesses}</div>
                  <div>운동추가 {window.payload.summary.addExerciseAdds}</div>
                </div>

                <div>
                  <div>저장 성공률: {Math.round(window.payload.rates.saveSuccessFromClicks * 100)}%</div>
                  <div>오픈 대비 저장: {Math.round(window.payload.rates.saveSuccessFromOpens * 100)}%</div>
                </div>

                <div>
                  <div>
                    저장 성공수 {saveCountTrend.arrow} {saveCountTrend.value}
                  </div>
                  <div>
                    저장 성공률 {saveRateTrend.arrow} {saveRateTrend.value}pp
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {uxThresholds.length > 0 ? (
          <div>
            {uxThresholds.map((threshold) => (
              <article
                key={threshold.id}
              >
                <div>{threshold.label}</div>
                <div>
                  {Math.round(threshold.value * 100)}% / 목표 {Math.round(threshold.target * 100)}%
                </div>
                <div>
                  {threshold.status === "ok" ? "기준 충족" : "개선 필요"}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {uxCompareMode ? (
          uxCompareRows.length > 0 ? (
            <div>
              <div>현재 vs 이전 구간 비교</div>
              <div>
                <table>
                  <thead>
                    <tr>
                      <th>지표</th>
                      <th>현재</th>
                      <th>이전</th>
                      <th>변화</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uxCompareRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.metric}</td>
                        <td>{row.current}</td>
                        <td>{row.previous}</td>
                        <td>{row.deltaText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyStateRows
              when={canShowDetailsEmptyState}
              label="비교 데이터 없음"
              description="현재 범위에서 이전 구간 비교를 계산할 수 없습니다."
            />
          )
        ) : null}
      </Card>

      <Card as="section">
        <div>
          <div>
            <div>볼륨 추세선</div>
            <div>{series ? `${series.bucket} 단위` : "—"}</div>
          </div>
          <div>포인트: {seriesPoints.length}</div>
        </div>
        {seriesPoints.length > 0 ? (
          <SparklineChart points={seriesPoints} labels={seriesLabels} tone="volume" />
        ) : (
          <EmptyStateRows
            when={canShowDetailsEmptyState}
            label="설정 값 없음"
            description="선택한 범위에 표시할 볼륨 시계열 데이터가 없습니다."
          />
        )}
      </Card>

      <Card as="section">
        <AccordionSection
          title="운동별 볼륨 분해"
          description="운동별 톤수와 세트 분포를 확인합니다."
          summarySlot={<span>{series?.byExercise?.length ?? 0}개</span>}
        >
          {series?.byExercise?.length ? (
            <div>
              <table>
                <thead>
                  <tr>
                    <th>운동</th>
                    <th>톤수</th>
                    <th>반복</th>
                    <th>세트</th>
                  </tr>
                </thead>
                <tbody>
                  {series.byExercise.map((r) => (
                    <tr key={r.exerciseId ?? r.exerciseName}>
                      <td>{r.exerciseName}</td>
                      <td>{Math.round(r.totals.tonnage)}</td>
                      <td>{r.totals.reps}</td>
                      <td>{r.totals.sets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when={canShowDetailsEmptyState}
              label="설정 값 없음"
              description="기간 내 운동별 볼륨 데이터가 없습니다."
            />
          )}
        </AccordionSection>
      </Card>

      <Card as="section">
        <AccordionSection
          title="플랜별 준수율"
          description="계획 세션 대비 완료 수를 비교합니다."
          summarySlot={<span>{compliance?.byPlan?.length ?? 0}개 플랜</span>}
        >
          {compliance?.byPlan?.length ? (
            <div>
              <table>
                <thead>
                  <tr>
                    <th>플랜</th>
                    <th>계획</th>
                    <th>완료</th>
                    <th>준수율</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.byPlan.map((r) => (
                    <tr key={r.planId}>
                      <td>{r.planName}</td>
                      <td>{r.planned}</td>
                      <td>{r.done}</td>
                      <td>{Math.round(r.compliance * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when={canShowCoreEmptyState}
              label="설정 값 없음"
              description="기간 내 준수율 데이터가 없습니다."
            />
          )}
        </AccordionSection>
      </Card>

      <Card as="section">
        <AccordionSection
          title="PR 추적"
          description="운동별 최고/최신 e1RM을 비교합니다."
          summarySlot={<span>{prs?.items?.length ?? 0}건</span>}
        >
          {prs?.items?.length ? (
            <div>
              <table>
                <thead>
                  <tr>
                    <th>운동</th>
                    <th>최고 e1RM</th>
                    <th>최신 e1RM</th>
                    <th>향상</th>
                    <th>최고 기록일</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.items.map((r) => {
                    const imp = trendMeta(r.improvement, 1);
                    return (
                      <tr key={r.exerciseId ?? r.exerciseName}>
                        <td>{r.exerciseName}</td>
                        <td>{r.best.e1rm}</td>
                        <td>{r.latest.e1rm}</td>
                        <td>
                          {imp.arrow} {imp.value}
                        </td>
                        <td>{r.best.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when={canShowDetailsEmptyState}
              label="설정 값 없음"
              description="기간 내 PR 기록이 없습니다."
            />
          )}
        </AccordionSection>
      </Card>

      {shouldRenderFiltersSheet ? (
        <StatsFiltersSheet
          open={filtersOpen}
          plans={plans}
          value={filterValues}
          onClose={() => setFiltersOpen(false)}
          onApply={applyFilters}
          onResetFilters={resetFilters}
        />
      ) : null}
    </div>
  );
}
