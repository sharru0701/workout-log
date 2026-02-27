"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AccordionSection } from "@/components/ui/accordion-section";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";

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
  deltaClassName: string;
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

function migrationRunStatusClassName(status: string) {
  if (status === "SUCCESS") return "text-emerald-700";
  if (status === "RUNNING") return "text-blue-700";
  if (status === "LOCK_TIMEOUT") return "text-red-700";
  if (status === "FAILED") return "text-red-700";
  if (status === "SKIPPED") return "text-amber-700";
  return "text-neutral-700";
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
    return { arrow: "→", className: "text-neutral-500", value: "0" };
  }
  if (delta > 0) {
    return {
      arrow: "↑",
      className: "text-emerald-700",
      value: `+${delta.toFixed(digits)}`,
    };
  }
  return {
    arrow: "↓",
    className: "text-red-700",
    value: delta.toFixed(digits),
  };
}

function MetricTile({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: { text: string; className: string };
}) {
  return (
    <article className="motion-card rounded-2xl border bg-white p-4">
      <div className="ui-card-label ui-card-label-caps">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-neutral-600">{detail}</div>
      {trend ? <div className={`mt-2 text-sm ${trend.className}`}>{trend.text}</div> : null}
    </article>
  );
}

function SparklineChart({
  points,
  labels,
  width = 320,
  height = 90,
}: {
  points: number[];
  labels: string[];
  width?: number;
  height?: number;
}) {
  if (!points.length) {
    return (
      <EmptyStateRows
        when
        label="설정 값 없음"
        description="선택한 범위에 표시할 볼륨 시계열 데이터가 없습니다."
      />
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1e-9, max - min);
  const pad = 10;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = points.map((v, i) => {
    const x = pad + (points.length === 1 ? w / 2 : (i * w) / (points.length - 1));
    const y = pad + h - ((v - min) / span) * h;
    return { x, y };
  });

  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `${d} L ${last.x.toFixed(1)} ${(height - pad).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(height - pad).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full rounded-xl border bg-white text-accent">
      <path d={area} fill="currentColor" fillOpacity="0.12" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx={last.x} cy={last.y} r="3.4" fill="currentColor" />
      <text x={pad} y={height - 4} fontSize="10" fill="currentColor">
        min {Math.round(min)}
      </text>
      <text x={width - pad} y={height - 4} textAnchor="end" fontSize="10" fill="currentColor">
        {labels[labels.length - 1]} · max {Math.round(max)}
      </text>
    </svg>
  );
}

export default function StatsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");

  const [exerciseId, setExerciseId] = useState("");
  const [exercise, setExercise] = useState("Back Squat");

  const [days, setDays] = useState(90);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayDateOnly());
  const [bucket, setBucket] = useState<"day" | "week" | "month">("week");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
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
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        if (cancelled) return;
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return "";
        });
      } catch {
        if (!cancelled) setPlans([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await fetchSettingsSnapshot();
        if (cancelled) return;
        setSettingsSnapshot(snapshot);
      } catch {
        if (!cancelled) {
          setSettingsSnapshot({});
        }
      }
    })();

    return () => {
      cancelled = true;
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
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
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
          apiGet<E1RMResp>(e1rmPath),
          apiGet<VolumeResp>(volumePath),
          apiGet<ComplianceResp>(compliancePath),
        ]);

        if (cancelled) return;
        setE1rm(e1rmRes);
        setVolume(volRes);
        setCompliance(compRes);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exercise, exerciseId, planId, rangeQuery, refreshTick]);

  useEffect(() => {
    if (!deferredDetailsReady) return;
    let cancelled = false;
    (async () => {
      try {
        setDetailsLoading(true);
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
          apiGet<VolumeSeriesResp>(seriesPath),
          apiGet<PRsResp>(prsPath),
          apiGet<UxSnapshotResp>(uxSnapshotPath),
        ]);

        if (cancelled) return;
        setSeries(seriesRes);
        setPrs(prsRes);
        setUxSnapshot(uxSnapshotRes);
        setUxFunnel(uxSnapshotRes.funnel);
        setUxSummaryWindows(uxSnapshotRes.windows);
      } catch (e: unknown) {
        if (cancelled) return;
        setDetailsError(e instanceof Error ? e.message : "Failed to load detailed stats");
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
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
    let cancelled = false;
    (async () => {
      try {
        setTrendLoading(true);
        const trendDays: Array<7 | 30 | 90> = [7, 30, 90];
        const trendCalls = trendDays.map(async (d) => {
          const [v, c] = await Promise.all([
            apiGet<VolumeResp>(`/api/stats/volume?${toQuery({ days: d, comparePrev: 1 })}`),
            apiGet<ComplianceResp>(
              `/api/stats/compliance?${toQuery({
                days: d,
                planId: planId || undefined,
                comparePrev: 1,
              })}`,
            ),
          ]);
          return { days: d, volume: v, compliance: c } satisfies TrendWindow;
        });

        const trendRes = await Promise.all(trendCalls);
        if (cancelled) return;
        setTrendWindows(trendRes);
      } catch {
        if (!cancelled) setTrendWindows([]);
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deferredBackgroundReady, planId, refreshTick]);

  useEffect(() => {
    if (!deferredBackgroundReady) return;
    let cancelled = false;
    (async () => {
      setMigrationTelemetryLoading(true);
      const path = `/api/stats/migration-telemetry?${toQuery({
        lookbackMinutes: migrationLookbackMinutes,
        limit: 20,
        runStatus: migrationRunStatusFilter === "ALL" ? undefined : migrationRunStatusFilter,
      })}`;
      try {
        const res = await fetch(path, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as unknown;
        if (cancelled) return;
        if (isMigrationTelemetryResp(body)) {
          setMigrationTelemetry(body);
        } else {
          setMigrationTelemetry(null);
        }
      } catch {
        if (!cancelled) setMigrationTelemetry(null);
      } finally {
        if (!cancelled) setMigrationTelemetryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
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
        className: "border-neutral-300 bg-neutral-100 text-neutral-700",
      };
    }
    if (migrationTelemetry.status === "critical") {
      return {
        label: "위험",
        className: "border-red-200 bg-red-100 text-red-700",
      };
    }
    if (migrationTelemetry.status === "warn") {
      return {
        label: "주의",
        className: "border-amber-200 bg-amber-100 text-amber-700",
      };
    }
    return {
      label: "정상",
      className: "border-emerald-200 bg-emerald-100 text-emerald-700",
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
        deltaClassName: trend.className,
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
        deltaClassName: trend.className,
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
  const pullToRefresh = usePullToRefresh({ onRefresh: refreshStatsPage });

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

  function resetFilters() {
    setPlanId("");
    setExerciseId("");
    setExercise("Back Squat");
    setFrom("");
    setTo(todayDateOnly());
    setBucket("week");
    setRangeIndex(2);
    setDays(90);
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
      className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll"
      {...pullToRefresh.bind}
    >
      <div className="pull-refresh-indicator">
        {pullToRefresh.isRefreshing
          ? "통계 새로고침 중..."
          : pullToRefresh.pullOffset > 0
            ? "당겨서 새로고침"
            : ""}
      </div>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="ios-section-heading">기본 흐름</div>
        <p className="text-sm text-neutral-600">1) 7/30/90일 선택 2) KPI 카드 확인 3) 필요 시 필터 조정</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESET_RANGES.map((d, idx) => (
            <button
              key={`core-${d}`}
              className={`haptic-tap rounded-xl border px-3 py-3 text-sm font-semibold ${
                idx === rangeIndex ? "bg-bg-elevated" : ""
              }`}
              onClick={() => {
                setRangeIndex(idx);
                setPresetRange(d);
              }}
            >
              {d}일
            </button>
          ))}
          <button className="haptic-tap rounded-xl border px-3 py-3 text-sm font-semibold col-span-2 sm:col-span-1" onClick={() => setFiltersOpen(true)}>
            필터
          </button>
        </div>
        <div className="rounded-xl border bg-neutral-50 p-3">
          <div className="ui-card-label">UX 분석 프리셋</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([1, 7, 14] as const).map((windowDays) => (
              <button
                key={`ux-preset-${windowDays}`}
                className={`haptic-tap rounded-lg border px-3 py-2 text-sm font-medium ${
                  activeUxPreset === windowDays ? "bg-bg-elevated" : ""
                }`}
                onClick={() => applyUxFocusPreset(windowDays)}
              >
                {windowDays === 1 ? "오늘" : `${windowDays}일`}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            범위를 UX 행동 분석에 맞춰 고정하고 집계 단위를 `day`로 자동 설정합니다.
          </div>
        </div>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="ui-card-label ui-card-label-caps">활성 필터</div>
            <div className="mt-1 text-sm text-neutral-600">플랜/범위/운동 조건을 세밀하게 바꿀 때만 필터를 사용하세요.</div>
          </div>
          <button className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium" onClick={() => setFiltersOpen(true)}>
            수정
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border px-3 py-2">플랜: {selectedPlanName ?? "전체 플랜"}</div>
          <div className="rounded-lg border px-3 py-2">집계 단위: {bucket}</div>
          <div className="rounded-lg border px-3 py-2">범위: {from ? `${from} → ${to || todayDateOnly()}` : `${days}일`}</div>
          <div className="rounded-lg border px-3 py-2">운동: {exerciseId || exercise || "—"}</div>
        </div>
        <LoadingStateRows
          active={loading}
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
      </section>

      <section
        className="motion-card rounded-2xl border bg-white p-4 space-y-3 touch-pan-y ui-height-animate"
        onTouchStart={onRangeSwipeStart}
        onTouchEnd={onRangeSwipeEnd}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="ui-card-label ui-card-label-caps">범위</div>
            <div className="text-lg font-semibold">{rangeHeadline}</div>
          </div>
          <div className="ui-card-label">버튼으로 선택하고 필요 시 스와이프하세요.</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PRESET_RANGES.map((d, idx) => (
            <button
              key={d}
              className={`haptic-tap rounded-xl border px-3 py-3 text-base font-semibold ${
                idx === rangeIndex ? "bg-bg-elevated" : ""
              }`}
              onClick={() => {
                setRangeIndex(idx);
                setPresetRange(d);
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border p-3">
            <div className="text-neutral-600">볼륨 ({activePresetDays}d)</div>
            <div className="text-lg font-semibold">{activeTrend ? formatKg(activeTrend.volume.totals.tonnage) : "—"}</div>
            {activeTrend ? (
              <div className={activeVolumeTrend.className}>
                {activeVolumeTrend.arrow} {activeVolumeTrend.value}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-neutral-600">준수율 ({activePresetDays}d)</div>
            <div className="text-lg font-semibold">
              {activeTrend ? `${Math.round(activeTrend.compliance.compliance * 100)}%` : "—"}
            </div>
            {activeTrend ? (
              <div className={activeComplianceTrend.className}>
                {activeComplianceTrend.arrow} {activeComplianceTrend.value}pp
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile
          label="e1RM"
          value={e1rm?.best ? `${e1rm.best.e1rm} kg` : "—"}
          detail={e1rm?.best ? `${e1rm.best.date} · ${e1rm.best.weightKg}×${e1rm.best.reps}` : "데이터 없음"}
        />
        <MetricTile
          label="볼륨"
          value={volume ? formatKg(volume.totals.tonnage) : "—"}
          detail={volume ? `반복 ${volume.totals.reps} · 세트 ${volume.totals.sets}` : "데이터 없음"}
          trend={
            volume
              ? {
                  text: `${volumeTrend.arrow} ${volumeTrend.value}`,
                  className: volumeTrend.className,
                }
              : undefined
          }
        />
        <MetricTile
          label="준수율"
          value={compliance ? `${Math.round(compliance.compliance * 100)}%` : "—"}
          detail={compliance ? `계획 ${compliance.planned} · 완료 ${compliance.done}` : "데이터 없음"}
          trend={
            compliance
              ? {
                  text: `${complianceTrend.arrow} ${complianceTrend.value}pp`,
                  className: complianceTrend.className,
                }
              : undefined
          }
        />
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="ui-card-label ui-card-label-caps">운영 마이그레이션 상태</div>
            <div className="mt-1 text-sm text-neutral-600">
              배포 시 실행되는 전용 migration job 상태를 최근 기록 기준으로 확인합니다.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${migrationStatusMeta.className}`}>
              {migrationStatusMeta.label}
            </span>
            <a className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium" href={migrationTelemetryJsonHref}>
              JSON
            </a>
            <a className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium" href={migrationTelemetryCsvHref}>
              CSV
            </a>
          </div>
        </div>

        <div className="rounded-xl border bg-neutral-50 p-3">
          <div className="ui-card-label">조회 구간 / 실행 필터</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MIGRATION_LOOKBACK_PRESETS.map((presetMinutes) => (
              <button
                key={`migration-lookback-${presetMinutes}`}
                type="button"
                className={`haptic-tap rounded-lg border px-3 py-2 text-sm font-medium ${
                  migrationLookbackMinutes === presetMinutes ? "bg-bg-elevated" : ""
                }`}
                onClick={() => setMigrationLookbackMinutes(presetMinutes)}
              >
                {formatLookbackLabel(presetMinutes)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-xs text-neutral-600">
              최근 {formatLookbackLabel(migrationLookbackMinutes)} 내 실행을 조회합니다.
            </div>
            <button
              type="button"
              className={`haptic-tap rounded-lg border px-3 py-1.5 text-xs font-medium ${
                migrationRunStatusFilter === "ISSUE" ? "bg-bg-elevated" : ""
              }`}
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border p-3 text-sm">
                <div className="text-neutral-600">마이그레이션 파일/적용</div>
                <div className="mt-1 text-lg font-semibold">
                  {migrationTelemetry.checks.migrations.appliedCount} /{" "}
                  {migrationTelemetry.checks.migrations.localCount}
                </div>
                <div className={migrationTelemetry.checks.migrations.pending > 0 ? "text-red-700" : "text-neutral-600"}>
                  pending {migrationTelemetry.checks.migrations.pending}
                </div>
              </div>
              <div className="rounded-xl border p-3 text-sm">
                <div className="text-neutral-600">
                  최근 {migrationTelemetry.checks.telemetry.lookbackMinutes}분 경고
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border px-2 py-2">
                    timeout {migrationTelemetry.checks.telemetry.alerts.lockTimeoutCount}
                  </div>
                  <div className="rounded-lg border px-2 py-2">
                    failed {migrationTelemetry.checks.telemetry.alerts.failedCount}
                  </div>
                  <div className="rounded-lg border px-2 py-2">
                    skipped {migrationTelemetry.checks.telemetry.alerts.skippedCount}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-3 text-sm">
                <div className="text-neutral-600">잠금 대기(ms)</div>
                <div className="mt-1 text-lg font-semibold">
                  avg {formatInteger(migrationTelemetry.checks.telemetry.alerts.avgLockWaitMs)}
                </div>
                <div className="text-neutral-600">
                  max {formatInteger(migrationTelemetry.checks.telemetry.alerts.maxLockWaitMs)}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-neutral-50 p-3 text-xs text-neutral-700">
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
              <div className="rounded-xl border bg-neutral-50 p-3 text-xs text-neutral-700">
                {migrationTelemetry.reasons.map((reason) => describeMigrationReason(reason)).join(" · ")}
              </div>
            ) : null}

            {recentMigrationRuns.length > 0 ? (
              <div className="space-y-2">
                <div className="ui-card-label">
                  실행 기록 {recentMigrationRuns.length}건 · 필터{" "}
                  {migrationRunStatusFilter === "ISSUE" ? "문제 상태만" : "전체 상태"}
                </div>
                <div className="overflow-x-auto">
                <table className="min-w-full text-sm ios-data-table">
                  <thead className="text-neutral-600">
                    <tr>
                      <th className="text-left py-2 pr-4">시각</th>
                      <th className="text-left py-2 px-4">상태</th>
                      <th className="text-left py-2 px-4">러너</th>
                      <th className="text-right py-2 px-4">Lock(ms)</th>
                      <th className="text-left py-2 pl-4">코드/메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMigrationRuns.map((run) => (
                      <tr key={run.runId} className="border-t">
                        <td className="py-2 pr-4 whitespace-nowrap">{formatDateTimeLocal(run.startedAt)}</td>
                        <td className={`py-2 px-4 whitespace-nowrap ${migrationRunStatusClassName(run.status)}`}>
                          {describeMigrationRunStatus(run.status)}
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap">{run.runner}</td>
                        <td className="py-2 px-4 text-right">{formatInteger(run.lockWaitMs)}</td>
                        <td className="py-2 pl-4 text-xs text-neutral-600">
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
                when
                label="실행 기록 없음"
                description={
                  migrationRunStatusFilter === "ISSUE"
                    ? "선택한 구간에 문제 상태 실행 기록이 없습니다."
                    : "migration_run_log에 최근 실행 기록이 없습니다."
                }
              />
            )}
          </>
        ) : migrationTelemetryLoading ? null : (
          <EmptyStateRows
            when
            label="운영 상태 로드 실패"
            description="마이그레이션 텔레메트리 응답이 없어 기본 통계만 표시합니다."
          />
        )}
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="ui-card-label ui-card-label-caps">UX 퍼널 (서버 집계)</div>
            <div className="mt-1 text-sm text-neutral-600">
              생성/저장/추가운동 포함 저장 흐름을 서버 로그 기반으로 집계합니다.
            </div>
          </div>
          <a className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium" href={uxFunnelCsvHref}>
            CSV 내보내기
          </a>
        </div>

        {uxFunnel ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {uxFunnel.steps.map((step) => (
                <article key={step.id} className="rounded-xl border p-3">
                  <div className="text-sm text-neutral-600">{step.label}</div>
                  <div className="mt-1 text-xl font-semibold">{step.count.toLocaleString()}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {step.conversionFromPrevious === null
                      ? "기준 단계"
                      : `이전 단계 대비 ${Math.round(step.conversionFromPrevious * 100)}%`}
                  </div>
                </article>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-xl border p-3">
                <div className="text-neutral-600">생성→저장</div>
                <div className="font-semibold">{Math.round(uxFunnel.rates.saveFromGenerate * 100)}%</div>
                <div className={uxSaveTrend.className}>
                  {uxSaveTrend.arrow} {uxSaveTrend.value}pp
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-neutral-600">저장→추가운동</div>
                <div className="font-semibold">{Math.round(uxFunnel.rates.extraFromSaved * 100)}%</div>
                <div className={uxExtraTrend.className}>
                  {uxExtraTrend.arrow} {uxExtraTrend.value}pp
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-neutral-600">일평균 생성</div>
                <div className="font-semibold">{uxFunnel.rates.generatedPerDay}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-neutral-600">일평균 저장</div>
                <div className="font-semibold">{uxFunnel.rates.savedPerDay}</div>
              </div>
            </div>

            <div className="rounded-xl border bg-neutral-50 p-3 text-sm">
              가장 큰 이탈 구간: <strong>{uxFunnel.dropoff.fromStepId}</strong> →{" "}
              <strong>{uxFunnel.dropoff.toStepId}</strong> ({uxFunnel.dropoff.dropCount}건,{" "}
              {Math.round(uxFunnel.dropoff.dropRate * 100)}%)
            </div>
          </>
        ) : (
          <EmptyStateRows
            when
            label="설정 값 없음"
            description="선택한 조건에서 UX 퍼널 데이터를 집계하지 못했습니다."
          />
        )}
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="ui-card-label ui-card-label-caps">UX 행동 요약 (오늘/7일/14일)</div>
            <div className="mt-1 text-sm text-neutral-600">
              서버 동기화 이벤트를 기준으로 기록 흐름의 안정성을 기간별로 비교합니다.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium"
              type="button"
              onClick={() => setUxCompareMode((prev) => !prev)}
            >
              {uxCompareMode ? "비교 모드 숨기기" : "비교 모드"}
            </button>
            <a
              className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium"
              href="/settings/ux-thresholds"
            >
              기준치 설정
            </a>
            <a
              className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium"
              href={uxSnapshotJsonHref}
            >
              스냅샷 JSON
            </a>
            <a
              className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium"
              href={uxSnapshotCsvHref}
            >
              스냅샷 CSV
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {uxSummaryCards.map(({ days: windowDays, window }) => {
            const label = windowDays === 1 ? "오늘" : `${windowDays}일`;
            if (!window) {
              return (
                <article key={`ux-summary-${windowDays}`} className="rounded-xl border p-3">
                  <div className="text-sm text-neutral-600">{label}</div>
                  <div className="mt-2 text-sm text-neutral-500">요약 데이터 로드 중...</div>
                </article>
              );
            }

            const saveRateTrend = trendMeta((window.payload.trend?.saveSuccessFromClicksDelta ?? 0) * 100, 1);
            const saveCountTrend = trendMeta(window.payload.trend?.saveSuccessesDelta ?? 0, 0);

            return (
              <article key={`ux-summary-${windowDays}`} className="rounded-xl border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-neutral-600">{label}</div>
                  <div className="ui-card-label">이벤트 {window.payload.totalEvents.toLocaleString()}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border px-2 py-2">오픈 {window.payload.summary.opens}</div>
                  <div className="rounded-lg border px-2 py-2">생성성공 {window.payload.summary.generateSuccesses}</div>
                  <div className="rounded-lg border px-2 py-2">저장성공 {window.payload.summary.saveSuccesses}</div>
                  <div className="rounded-lg border px-2 py-2">운동추가 {window.payload.summary.addExerciseAdds}</div>
                </div>

                <div className="rounded-lg border bg-neutral-50 px-2 py-2 text-xs">
                  <div>저장 성공률: {Math.round(window.payload.rates.saveSuccessFromClicks * 100)}%</div>
                  <div>오픈 대비 저장: {Math.round(window.payload.rates.saveSuccessFromOpens * 100)}%</div>
                </div>

                <div className="grid grid-cols-1 gap-1 text-xs">
                  <div className={saveCountTrend.className}>
                    저장 성공수 {saveCountTrend.arrow} {saveCountTrend.value}
                  </div>
                  <div className={saveRateTrend.className}>
                    저장 성공률 {saveRateTrend.arrow} {saveRateTrend.value}pp
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {uxThresholds.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {uxThresholds.map((threshold) => (
              <article
                key={threshold.id}
                className={`rounded-xl border p-3 ${
                  threshold.status === "ok" ? "bg-emerald-50/60" : "bg-amber-50/70"
                }`}
              >
                <div className="text-xs text-neutral-600">{threshold.label}</div>
                <div className="mt-1 text-base font-semibold">
                  {Math.round(threshold.value * 100)}% / 목표 {Math.round(threshold.target * 100)}%
                </div>
                <div className={`mt-1 text-xs ${threshold.status === "ok" ? "text-emerald-700" : "text-amber-700"}`}>
                  {threshold.status === "ok" ? "기준 충족" : "개선 필요"}
                </div>
                <div className="mt-1 text-xs text-neutral-600">{threshold.hint}</div>
              </article>
            ))}
          </div>
        ) : null}

        {uxCompareMode ? (
          uxCompareRows.length > 0 ? (
            <div className="rounded-xl border p-3">
              <div className="ui-card-label ui-card-label-caps mb-2">현재 vs 이전 구간 비교</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm ios-data-table">
                  <thead className="text-neutral-600">
                    <tr>
                      <th className="text-left py-2 pr-4">지표</th>
                      <th className="text-right py-2 px-4">현재</th>
                      <th className="text-right py-2 px-4">이전</th>
                      <th className="text-right py-2 pl-4">변화</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uxCompareRows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="py-2 pr-4">{row.metric}</td>
                        <td className="py-2 px-4 text-right">{row.current}</td>
                        <td className="py-2 px-4 text-right">{row.previous}</td>
                        <td className={`py-2 pl-4 text-right ${row.deltaClassName}`}>{row.deltaText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyStateRows
              when
              label="비교 데이터 없음"
              description="현재 범위에서 이전 구간 비교를 계산할 수 없습니다."
            />
          )
        ) : null}
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-neutral-600">볼륨 추세선</div>
            <div className="text-lg font-semibold">{series ? `${series.bucket} 단위` : "—"}</div>
          </div>
          <div className="ui-card-label">포인트: {seriesPoints.length}</div>
        </div>
        <SparklineChart points={seriesPoints} labels={seriesLabels} />
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="운동별 볼륨 분해"
          description="운동별 톤수와 세트 분포를 확인합니다."
          summarySlot={<span className="ui-card-label">{series?.byExercise?.length ?? 0}개</span>}
        >
          {series?.byExercise?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm ios-data-table">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">운동</th>
                    <th className="text-right py-2 px-4">톤수</th>
                    <th className="text-right py-2 px-4">반복</th>
                    <th className="text-right py-2 pl-4">세트</th>
                  </tr>
                </thead>
                <tbody>
                  {series.byExercise.map((r) => (
                    <tr key={r.exerciseId ?? r.exerciseName} className="border-t">
                      <td className="py-2 pr-4">{r.exerciseName}</td>
                      <td className="py-2 px-4 text-right">{Math.round(r.totals.tonnage)}</td>
                      <td className="py-2 px-4 text-right">{r.totals.reps}</td>
                      <td className="py-2 pl-4 text-right">{r.totals.sets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when
              label="설정 값 없음"
              description="기간 내 운동별 볼륨 데이터가 없습니다."
            />
          )}
        </AccordionSection>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="플랜별 준수율"
          description="계획 세션 대비 완료 수를 비교합니다."
          summarySlot={<span className="ui-card-label">{compliance?.byPlan?.length ?? 0}개 플랜</span>}
        >
          {compliance?.byPlan?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm ios-data-table">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">플랜</th>
                    <th className="text-right py-2 px-4">계획</th>
                    <th className="text-right py-2 px-4">완료</th>
                    <th className="text-right py-2 pl-4">준수율</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.byPlan.map((r) => (
                    <tr key={r.planId} className="border-t">
                      <td className="py-2 pr-4">{r.planName}</td>
                      <td className="py-2 px-4 text-right">{r.planned}</td>
                      <td className="py-2 px-4 text-right">{r.done}</td>
                      <td className="py-2 pl-4 text-right">{Math.round(r.compliance * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when
              label="설정 값 없음"
              description="기간 내 준수율 데이터가 없습니다."
            />
          )}
        </AccordionSection>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="PR 추적"
          description="운동별 최고/최신 e1RM을 비교합니다."
          summarySlot={<span className="ui-card-label">{prs?.items?.length ?? 0}건</span>}
        >
          {prs?.items?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm ios-data-table">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">운동</th>
                    <th className="text-right py-2 px-4">최고 e1RM</th>
                    <th className="text-right py-2 px-4">최신 e1RM</th>
                    <th className="text-right py-2 px-4">향상</th>
                    <th className="text-right py-2 pl-4">최고 기록일</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.items.map((r) => {
                    const imp = trendMeta(r.improvement, 1);
                    return (
                      <tr key={r.exerciseId ?? r.exerciseName} className="border-t">
                        <td className="py-2 pr-4">{r.exerciseName}</td>
                        <td className="py-2 px-4 text-right">{r.best.e1rm}</td>
                        <td className="py-2 px-4 text-right">{r.latest.e1rm}</td>
                        <td className={`py-2 px-4 text-right ${imp.className}`}>
                          {imp.arrow} {imp.value}
                        </td>
                        <td className="py-2 pl-4 text-right">{r.best.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when
              label="설정 값 없음"
              description="기간 내 PR 기록이 없습니다."
            />
          )}
        </AccordionSection>
      </section>

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="통계 필터"
        description="범위를 정하고 추세 구간을 비교합니다."
      >
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button className="haptic-tap rounded-xl border px-3 py-3 text-sm font-medium" onClick={resetFilters}>
              기본값으로 재설정
            </button>
            <button className="haptic-tap rounded-xl border px-3 py-3 text-sm font-medium" onClick={() => setFiltersOpen(false)}>
              적용하고 닫기
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">플랜</span>
              <select className="rounded-lg border px-3 py-3 text-base" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">전체 플랜</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.type}]
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="ui-card-label">집계 단위</span>
              <select
                className="rounded-lg border px-3 py-3 text-base"
                value={bucket}
                onChange={(e) => setBucket(e.target.value as "day" | "week" | "month")}
              >
                <option value="day">일</option>
                <option value="week">주</option>
                <option value="month">월</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">시작일(선택)</span>
              <input type="date" className="rounded-lg border px-3 py-3 text-base" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">종료일(선택)</span>
              <input type="date" className="rounded-lg border px-3 py-3 text-base" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>

          <div className="rounded-xl border px-3 py-2 text-xs text-neutral-600">
            고급 e1RM 범위(선택): 정확히 지정할 때는 `exerciseId`, 이름 기준으로 찾을 때는 `exercise`를 사용합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">e1RM exerciseId</span>
              <input className="rounded-lg border px-3 py-3 text-base" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">e1RM exercise</span>
              <input className="rounded-lg border px-3 py-3 text-base" value={exercise} onChange={(e) => setExercise(e.target.value)} />
            </label>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
