"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { apiGet, isAbortError } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { AccordionSection } from "@/components/ui/accordion-section";
import { EmptyStateRows, ErrorStateRows } from "@/components/ui/settings-state";
import { Card } from "@/components/ui/card";
import { DashboardScreen, DashboardHero, DashboardSection } from "@/components/dashboard/dashboard-primitives";

// 임시로 주석 처리하거나 올바른 경로로 수정
// const StatsFiltersSheet = dynamic(() => import("../../stats/_components/stats-filters-sheet"), {
//   ssr: false,
//   loading: () => null,
// });

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

type UxSummaryWindow = {
  days: 1 | 7 | 14;
  payload: UxEventsSummaryResp;
};

type UxSnapshotResp = {
  exportedAt: string;
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

type MigrationTelemetryResp = {
  ts: string;
  status: "ok" | "warn" | "critical";
  reasons: string[];
  checks: {
    migrations: {
      localCount: number;
      appliedCount: number;
      pending: number;
      latestAppliedAt: string | null;
      latestAppliedHash: string | null;
    };
    telemetry: {
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
        status: string;
        errorCode: string | null;
        message: string | null;
        startedAt: string;
        lockWaitMs: number;
      }>;
    };
  };
};

const MIGRATION_LOOKBACK_PRESETS = [120, 720, 1440, 4320] as const;

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

function formatInteger(value: number) {
  return Math.round(value).toLocaleString();
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });
}

function trendMeta(delta: number, digits = 1) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
    return { arrow: "→", tone: "flat" as const, value: "0" };
  }
  return delta > 0 
    ? { arrow: "↑", tone: "up" as const, value: `+${delta.toFixed(digits)}` }
    : { arrow: "↓", tone: "down" as const, value: delta.toFixed(digits) };
}

export default function SystemStatsPage() {
  const [uxSnapshot, setUxSnapshot] = useState<UxSnapshotResp | null>(null);
  const [migrationTelemetry, setMigrationTelemetry] = useState<MigrationTelemetryResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lookback, setLookback] = useState<number>(720);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => setRefreshTick(t => t + 1),
    triggerSelector: "[data-pull-refresh-trigger]",
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [uxRes, migRes] = await Promise.all([
          apiGet<UxSnapshotResp>(`/api/stats/ux-snapshot?windows=1,7,14&comparePrev=1`, { signal: controller.signal }),
          apiGet<MigrationTelemetryResp>(`/api/stats/migration-telemetry?lookbackMinutes=${lookback}&limit=20`, { signal: controller.signal })
        ]);
        if (cancelled) return;
        setUxSnapshot(uxRes);
        setMigrationTelemetry(migRes);
      } catch (e) {
        if (!cancelled && !isAbortError(e)) console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [refreshTick, lookback]);

  return (
    <div {...pullToRefresh.bind}>
      <PullToRefreshIndicator 
        {...pullToRefresh}
        refreshingLabel="시스템 통계 갱신 중..."
        completeLabel="시스템 통계 확인 완료"
      />
      <DashboardScreen>
        <DashboardHero 
          tone="quiet"
          eyebrow="관리 도구"
          title="시스템 통계"
          description="앱 운영 상태와 UX 퍼널 지표를 모니터링합니다."
        />

        <DashboardSection title="데이터베이스 마이그레이션" headerTrigger>
          <Card padding="md">
            <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
              {MIGRATION_LOOKBACK_PRESETS.map(p => (
                <button key={p} onClick={() => setLookback(p)} className={`label ${lookback === p ? "label-primary" : "label-neutral"}`}>
                  {p >= 1440 ? `${p/1440}일` : p >= 60 ? `${p/60}시간` : `${p}분`}
                </button>
              ))}
            </div>
            {migrationTelemetry && (
              <div style={{ fontSize: "14px", display: "grid", gap: "var(--space-xs)" }}>
                <div>상태: <span className={`label ${migrationTelemetry.status === "ok" ? "label-complete" : "label-danger"}`}>{migrationTelemetry.status.toUpperCase()}</span></div>
                <div>적용: {migrationTelemetry.checks.migrations.appliedCount} / {migrationTelemetry.checks.migrations.localCount} (대기: {migrationTelemetry.checks.migrations.pending})</div>
                <div>최근 실패: {formatDateTimeLocal(migrationTelemetry.checks.telemetry.alerts.latestFailureAt)}</div>
              </div>
            )}
          </Card>
        </DashboardSection>

        <DashboardSection title="UX 퍼널 분석">
          {uxSnapshot?.funnel && (
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              {uxSnapshot.funnel.steps.map(step => (
                <Card key={step.id} padding="md">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{step.label}</span>
                    <span className="metric-value">{step.count.toLocaleString()}</span>
                  </div>
                  {step.conversionFromPrevious !== null && (
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>전 단계 대비 {Math.round(step.conversionFromPrevious * 100)}%</div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </DashboardSection>

        <DashboardSection title="주요 지표 기준치 점검">
          <div style={{ display: "grid", gap: "var(--space-sm)" }}>
            {uxSnapshot?.thresholds.map(t => (
              <Card key={t.id} padding="sm">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px" }}>{t.label}</span>
                  <span className={`label ${t.status === "ok" ? "label-complete" : "label-warning"}`}>
                    {Math.round(t.value * 100)}% / 목표 {Math.round(t.target * 100)}%
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </DashboardSection>
      </DashboardScreen>
    </div>
  );
}
