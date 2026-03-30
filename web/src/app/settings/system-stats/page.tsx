"use client";

import React, { useEffect, useState } from "react";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import { apiGet, isAbortError } from "@/lib/api";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/components/locale-provider";

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

function formatIntegerByLocale(value: number, locale: "ko" | "en") {
  return Math.round(value).toLocaleString(locale === "ko" ? "ko-KR" : "en-US");
}

function formatDateTimeLocal(value: string | null, locale: "ko" | "en") {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });
}

export default function SystemStatsPage() {
  const { locale } = useLocale();
  const [uxSnapshot, setUxSnapshot] = useState<UxSnapshotResp | null>(null);
  const [migrationTelemetry, setMigrationTelemetry] = useState<MigrationTelemetryResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lookback, setLookback] = useState<number>(720);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => setRefreshTick(t => t + 1),
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
    <PullToRefreshShell pullToRefresh={pullToRefresh}>
      <div>
        <div style={{ marginBottom: "var(--space-xl)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-primary)", marginBottom: "4px" }}>
            {locale === "ko" ? "관리 도구" : "Admin Tools"}
          </div>
          <h1 style={{ fontFamily: "var(--font-headline-family)", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "0 0 var(--space-sm)" }}>
            {locale === "ko" ? "시스템 통계" : "System Stats"}
          </h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
            {locale === "ko" ? "앱 운영 상태와 UX 퍼널 지표를 모니터링합니다." : "Monitor app health and UX funnel signals."}
          </p>
        </div>

        {loading ? (
          <Card padding="md" tone="inset" elevated={false} style={{ marginBottom: "var(--space-lg)" }}>
            <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
              {locale === "ko" ? "시스템 통계를 불러오는 중..." : "Loading system stats..."}
            </div>
          </Card>
        ) : null}

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
              {locale === "ko" ? "마이그레이션" : "Migrations"}
            </h2>
          </div>
          <Card padding="md">
            <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
              {MIGRATION_LOOKBACK_PRESETS.map(p => (
                <button key={p} onClick={() => setLookback(p)} className={`label ${lookback === p ? "label-primary" : "label-neutral"}`}>
                  {p >= 1440 ? `${p/1440}${locale === "ko" ? "일" : "d"}` : p >= 60 ? `${p/60}${locale === "ko" ? "시간" : "h"}` : `${p}${locale === "ko" ? "분" : "m"}`}
                </button>
              ))}
            </div>
            {migrationTelemetry && (
              <div style={{ fontSize: "14px", display: "grid", gap: "var(--space-xs)" }}>
                <div>{locale === "ko" ? "상태" : "Status"}: <span className={`label ${migrationTelemetry.status === "ok" ? "label-complete" : "label-danger"}`}>{migrationTelemetry.status.toUpperCase()}</span></div>
                <div>{locale === "ko" ? "적용" : "Applied"}: {formatIntegerByLocale(migrationTelemetry.checks.migrations.appliedCount, locale)} / {formatIntegerByLocale(migrationTelemetry.checks.migrations.localCount, locale)} ({locale === "ko" ? "대기" : "Pending"}: {formatIntegerByLocale(migrationTelemetry.checks.migrations.pending, locale)})</div>
                <div>{locale === "ko" ? "최근 실패" : "Latest failure"}: {formatDateTimeLocal(migrationTelemetry.checks.telemetry.alerts.latestFailureAt, locale)}</div>
              </div>
            )}
            {!migrationTelemetry && !loading ? (
              <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                {locale === "ko" ? "마이그레이션 텔레메트리가 아직 없습니다." : "No migration telemetry is available yet."}
              </div>
            ) : null}
          </Card>
        </section>

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
              {locale === "ko" ? "UX 퍼널 분석" : "UX Funnel"}
            </h2>
          </div>
          {uxSnapshot?.funnel && (
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              {uxSnapshot.funnel.steps.map(step => (
                <Card key={step.id} padding="md">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{step.label}</span>
                    <span className="metric-value">{formatIntegerByLocale(step.count, locale)}</span>
                  </div>
                  {step.conversionFromPrevious !== null && (
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                      {locale === "ko" ? "전 단계 대비" : "From previous step"} {Math.round(step.conversionFromPrevious * 100)}%
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
          {!uxSnapshot?.funnel && !loading ? (
            <Card padding="md" tone="inset" elevated={false}>
              <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                {locale === "ko" ? "UX 퍼널 데이터가 아직 없습니다." : "No UX funnel data is available yet."}
              </div>
            </Card>
          ) : null}
        </section>

        <section>
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
              {locale === "ko" ? "주요 지표 기준치" : "Metric Thresholds"}
            </h2>
          </div>
          <div style={{ display: "grid", gap: "var(--space-sm)" }}>
            {uxSnapshot?.thresholds.map(t => (
              <Card key={t.id} padding="sm">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px" }}>{t.label}</span>
                  <span className={`label ${t.status === "ok" ? "label-complete" : "label-warning"}`}>
                    {Math.round(t.value * 100)}% / {locale === "ko" ? "목표" : "Target"} {Math.round(t.target * 100)}%
                  </span>
                </div>
              </Card>
            ))}
            {!uxSnapshot?.thresholds?.length && !loading ? (
              <Card padding="md" tone="inset" elevated={false}>
                <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                  {locale === "ko" ? "기준치 데이터가 아직 없습니다." : "No threshold data is available yet."}
                </div>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </PullToRefreshShell>
  );
}
