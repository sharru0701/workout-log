"use client";

import { type CSSProperties } from "react";
import { useLocale } from "@/components/locale-provider";
import { EmptyStateRows, ErrorStateRows } from "@/components/ui/settings-state";
import {
  TermBadge,
  TermLineChart,
  TermProgress,
  TermSparkline,
} from "@/components/v2/terminal";
import { useStats1RMController } from "@/features/stats/model/use-stats-1rm-controller";
import { clampIndex } from "@/features/stats/ui/e1rm-interactive-chart";
import { Stats1RMOverlaySheets } from "@/features/stats/ui/stats-1rm-overlay-sheets";
import type { RangePreset } from "@/features/stats/model/stats-1rm-types";
import type { StatsPageBootstrap } from "@/server/services/stats/get-stats-page-bootstrap";
import type { AsymptoteMonitorResult } from "@/server/stats/asymptote-monitor-service";
import type {
  DriverKey,
  DriverTrendDirection,
} from "@workout/core/program-engine/asymptote-monitor";

// terminal(ironlog) stats 뷰 — paper StatsScreen/Stats1RMDetailed의 terminal 대응(P2-b).
// useStats1RMController(presentation-agnostic) + Stats1RMOverlaySheets(시트)를 그대로
// 공유하고 표현만 TUI로 분기. 1RM 추세=SVG fine 라인(§5), 기간탭/배지/readout는 글리프.
// 무거운 섹션(goal/asymptote/weekly volume)은 후속. TermShell ViewPane 안 렌더라 외곽 패딩 없음.

const RANGE_TABS: { preset: Exclude<RangePreset, "CUSTOM">; label: string }[] = [
  { preset: 7, label: "7D" },
  { preset: 30, label: "1M" },
  { preset: 90, label: "3M" },
  { preset: 180, label: "6M" },
  { preset: 365, label: "1Y" },
];

function formatKg(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}t`;
  return `${Math.round(value)}kg`;
}

type StatsTuiViewProps = Pick<
  StatsPageBootstrap,
  | "initialBundle"
  | "initialExercises"
  | "initialPlans"
  | "initialE1rm"
  | "initialVolumeWeekly"
  | "initialSelectedExerciseId"
  | "initialSelectedPlanId"
  | "goal"
  | "goalMetrics"
  | "asymptoteMonitor"
>;

export function StatsTuiView({
  initialBundle,
  initialExercises,
  initialPlans,
  initialE1rm,
  initialVolumeWeekly,
  initialSelectedExerciseId,
  initialSelectedPlanId,
  goal,
  goalMetrics,
  asymptoteMonitor,
}: StatsTuiViewProps) {
  const { locale } = useLocale();
  const c = useStats1RMController({
    locale,
    refreshTick: 0,
    initialExercises,
    initialPlans,
    initialStats: initialE1rm,
    initialSelectedExerciseId,
    initialSelectedPlanId,
  });

  const series = c.selectedSeries;
  const hasChartData = series.length > 0;
  const activeIdx = hasChartData
    ? clampIndex(c.activePointIndex, series.length)
    : 0;
  const activePoint = hasChartData ? series[activeIdx] : null;
  const e1rmValues = series.map((p) => p.e1rm);
  const improvedPrCount = initialBundle.prs90d.filter(
    (p) => p.improvement > 0,
  ).length;

  return (
    <section
      aria-label={locale === "ko" ? "통계" : "Stats"}
      style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-4)" }}
    >
      {/* 세션 메트릭 readout */}
      <div
        className="v2-mono-label"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--v2-s-1) var(--v2-s-3)",
        }}
      >
        <Stat
          label={locale === "ko" ? "30일 세션" : "30d sess"}
          value={String(initialBundle.sessions30d)}
        />
        <Stat
          label={locale === "ko" ? "30일 볼륨" : "30d vol"}
          value={formatKg(initialBundle.tonnage30d)}
        />
        <Stat
          label={locale === "ko" ? "최고 e1RM" : "best e1RM"}
          value={initialE1rm?.best ? `${initialE1rm.best.e1rm.toFixed(1)}kg` : "—"}
          tone="gold"
        />
        <Stat
          label={locale === "ko" ? "90일 PR" : "90d PR"}
          value={`${initialBundle.prs90d.length} (+${improvedPrCount})`}
        />
      </div>

      {/* 1RM 추세 패널 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--v2-s-2)",
          padding: "var(--v2-s-3)",
          background: "var(--term-panel)",
          boxShadow: "inset 0 0 0 1px var(--term-line-box)",
          borderRadius: "var(--v2-r-2)",
        }}
      >
        {/* 운동/플랜 선택 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--v2-s-2)",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => c.setActiveSheet("exercise")}
            className="v2-mono-label"
            style={selectorStyle("var(--term-fg)")}
          >
            {c.selectedExercise?.name ??
              (locale === "ko" ? "운동 선택" : "select lift")}{" "}
            <span style={{ color: "var(--term-dim)" }}>▾</span>
          </button>
          <button
            type="button"
            onClick={() => c.setActiveSheet("program")}
            className="v2-mono-label"
            style={selectorStyle("var(--term-dim)")}
          >
            {c.selectedProgramLabel} <span>▾</span>
          </button>
        </div>

        {/* 기간 탭 + custom */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--v2-s-1)" }}>
          {RANGE_TABS.map((t) => {
            const active = c.rangeFilter.preset === t.preset;
            return (
              <button
                key={t.preset}
                type="button"
                onClick={() => c.setPresetRange(t.preset)}
                className="v2-mono-label"
                style={tabStyle(active)}
              >
                [{t.label}
                {active ? "*" : ""}]
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => c.setActiveSheet("range")}
            className="v2-mono-label"
            style={tabStyle(c.rangeFilter.preset === "CUSTOM")}
          >
            [{locale === "ko" ? "기간" : "range"}]
          </button>
        </div>

        {/* 에러/빈 상태(공유 컴포넌트, terminal 토큰 리스킨) */}
        <ErrorStateRows
          message={c.optionsError}
          title={locale === "ko" ? "필터 옵션 오류" : "Filter options error"}
          onRetry={() => void c.loadFilterOptions()}
        />
        {!c.showNoExerciseState ? (
          <ErrorStateRows
            message={c.error}
            title={locale === "ko" ? "1RM 데이터 오류" : "1RM data error"}
            onRetry={() => c.retryDataLoad()}
          />
        ) : null}
        <EmptyStateRows
          when={c.showNoExerciseState}
          label={locale === "ko" ? "운동종목 없음" : "No exercises"}
        />
        <EmptyStateRows
          when={c.showDataEmptyState}
          label={
            locale === "ko" ? "선택 조합 데이터 없음" : "No data for filters"
          }
        />

        {/* 차트 + readout */}
        {hasChartData ? (
          <>
            <TermLineChart values={e1rmValues} />
            <div
              className="v2-mono-label"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--v2-s-2)",
                flexWrap: "wrap",
              }}
            >
              <TermSparkline data={e1rmValues} width={20} markPeak />
              {activePoint ? (
                <span style={{ color: "var(--term-cyan)" }}>
                  {activePoint.e1rm.toFixed(1)}kg
                </span>
              ) : null}
              {c.stats?.best ? (
                <span style={{ color: "var(--term-gold)" }}>
                  ★ {c.stats.best.e1rm.toFixed(1)}kg
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {/* 주간 볼륨 추세 */}
      {initialVolumeWeekly && initialVolumeWeekly.series.length > 1 ? (
        <div
          className="v2-mono-label"
          style={{ display: "flex", alignItems: "center", gap: "var(--v2-s-2)" }}
        >
          <span style={{ color: "var(--term-dim)" }}>
            {locale === "ko" ? "주간 볼륨" : "weekly vol"}
          </span>
          <TermSparkline
            data={initialVolumeWeekly.series.map((p) => p.tonnage)}
            width={20}
            tone="accent"
            markPeak
          />
          <span style={{ color: "var(--term-amber)", marginLeft: "auto" }}>
            {formatKg(initialVolumeWeekly.series.at(-1)?.tonnage ?? 0)}
          </span>
        </div>
      ) : null}

      {/* 하이브리드(asymptote) 드라이버 e1RM 추세 모니터 (paper asymptote-monitor-section 대응) */}
      {asymptoteMonitor ? (
        <AsymptoteMonitor data={asymptoteMonitor} locale={locale} />
      ) : null}

      {/* 목표 지표 (goal-aware: 근력→Big3 · 근비대→근육볼륨 · 지구력→시간) */}
      {goalMetrics ? (
        <GoalMetric goal={goal} metrics={goalMetrics} locale={locale} />
      ) : null}

      {/* PR 리스트 (90일) */}
      {initialBundle.prs90d.length > 0 ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}
        >
          <span className="v2-mono-label" style={{ color: "var(--term-dim)" }}>
            {locale === "ko" ? "PR · 90일" : "PR · 90d"}
          </span>
          {initialBundle.prs90d.slice(0, 6).map((row) => (
            <div
              key={row.exerciseId ?? row.exerciseName}
              className="v2-mono-label"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--v2-s-2)",
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--term-fg)",
                }}
              >
                {row.exerciseName}
              </span>
              <span style={{ color: "var(--term-cyan)", whiteSpace: "nowrap" }}>
                {row.best?.e1rm ?? "—"}kg
              </span>
              <TermBadge tone={row.improvement > 0 ? "success" : "dim"}>
                {row.improvement > 0
                  ? `+${row.improvement.toFixed(1)}`
                  : row.improvement.toFixed(1)}
              </TermBadge>
            </div>
          ))}
        </div>
      ) : null}

      {/* 운동/플랜/기간 피커 시트 (공유, terminal CSS 리스킨) */}
      <Stats1RMOverlaySheets
        locale={locale}
        activeSheet={c.activeSheet}
        onClose={() => c.setActiveSheet(null)}
        exerciseQuery={c.exerciseQuery}
        onExerciseQueryChange={c.setExerciseQuery}
        filteredExerciseOptions={c.filteredExerciseOptions}
        programQuery={c.programQuery}
        onProgramQueryChange={c.setProgramQuery}
        filteredProgramOptions={c.filteredProgramOptions}
        optionsLoading={c.optionsLoading}
        rangeDraft={c.rangeDraft}
        onRangeDraftChange={(next) => {
          c.setRangeDraft(next);
          c.setRangeDraftError(null);
        }}
        rangeDraftError={c.rangeDraftError}
        applyRangeDraft={c.applyRangeDraft}
        canApplyRangeDraft={c.canApplyRangeDraft}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold";
}) {
  return (
    <span style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-s-2)" }}>
      <span style={{ color: "var(--term-dim)" }}>{label}</span>
      <span
        style={{ color: tone === "gold" ? "var(--term-gold)" : "var(--term-cyan)" }}
      >
        {value}
      </span>
    </span>
  );
}

const GOAL_PANEL: CSSProperties = {
  padding: "var(--v2-s-3)",
  background: "var(--term-panel)",
  boxShadow: "inset 0 0 0 1px var(--term-line-box)",
  borderRadius: "var(--v2-r-2)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--v2-s-1)",
};

const MUSCLE_KO: Record<string, string> = {
  Quad: "대퇴",
  Hamstring: "햄스트링",
  Glute: "둔근",
  Back: "등",
  Chest: "가슴",
  Shoulder: "어깨",
  Arm: "팔",
  Core: "코어",
  Other: "기타",
};

// 목표 지표 — goal별 분기(paper GoalSection의 terminal 대응). 근력/파워→Big3 토탈,
// 근비대→근육군 볼륨 바, 지구력→운동 시간. general은 표시 안 함.
function GoalMetric({
  goal,
  metrics,
  locale,
}: {
  goal: StatsPageBootstrap["goal"];
  metrics: NonNullable<StatsPageBootstrap["goalMetrics"]>;
  locale: "ko" | "en";
}) {
  const ko = locale === "ko";
  const between: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: "var(--v2-s-2)",
  };

  if ((goal === "strength" || goal === "powerlifting") && metrics.strengthScore) {
    const s = metrics.strengthScore;
    return (
      <div style={GOAL_PANEL}>
        <div className="v2-mono-label" style={between}>
          <span style={{ color: "var(--term-dim)" }}>{ko ? "3대 토탈" : "Big3"}</span>
          <span style={{ color: "var(--term-gold)" }}>
            {s.totalE1rmKg > 0 ? `${Math.round(s.totalE1rmKg)}kg` : "—"}
            {s.totalBodyweightRatio !== null
              ? ` · ${s.totalBodyweightRatio.toFixed(2)}×`
              : ""}
          </span>
        </div>
        {s.big3.map((lift) => (
          <div key={lift.liftName} className="v2-mono-label" style={between}>
            <span style={{ color: "var(--term-fg)" }}>{lift.liftName}</span>
            <span style={{ color: "var(--term-cyan)" }}>
              {lift.bestE1rmKg !== null ? `${Math.round(lift.bestE1rmKg)}kg` : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (goal === "hypertrophy" && metrics.muscleVolume) {
    const totals = metrics.muscleVolume.totals
      .filter((t) => t.tonnageKg > 0)
      .slice(0, 6);
    if (totals.length === 0) return null;
    const max = totals.reduce((m, t) => Math.max(m, t.tonnageKg), 1);
    return (
      <div style={GOAL_PANEL}>
        <div className="v2-mono-label" style={{ color: "var(--term-dim)" }}>
          {ko ? "근육군 볼륨" : "muscle volume"}
        </div>
        {totals.map((t) => (
          <TermProgress
            key={t.muscleGroup}
            ratio={t.tonnageKg / max}
            tone="success"
            label={(ko ? MUSCLE_KO[t.muscleGroup] : t.muscleGroup) ?? t.muscleGroup}
            value={`${Math.round(t.tonnageKg)}kg`}
          />
        ))}
      </div>
    );
  }

  if (goal === "endurance" && metrics.endurance) {
    const e = metrics.endurance;
    return (
      <div style={GOAL_PANEL}>
        <div className="v2-mono-label" style={between}>
          <span style={{ color: "var(--term-dim)" }}>
            {ko ? "운동 시간" : "training time"}
          </span>
          <span style={{ color: "var(--term-cyan)" }}>
            {Math.round(e.totals.totalMinutes)}min · avg{" "}
            {Math.round(e.totals.averageSessionMinutes ?? 0)}min
          </span>
        </div>
      </div>
    );
  }

  return null;
}

// 드라이버 라벨(모노 그리드 정합 위해 Latin, redesign-target §3/R7) — paper DRIVER_LABELS 대응.
const DRIVER_LABELS: Record<DriverKey, { ko: string; en: string }> = {
  SQUAT: { ko: "스쿼트", en: "Squat" },
  BENCH: { ko: "벤치", en: "Bench" },
  PULL: { ko: "풀업", en: "Pull-Up" },
};

// 추세 → 글리프(term-icon UNICODE_GLYPH와 동일 매핑: ↗/↘/→)·색·라벨.
function trendGlyph(
  trend: DriverTrendDirection,
  locale: "ko" | "en",
): { glyph: string; color: string; label: string } {
  switch (trend) {
    case "RISING":
      return { glyph: "↗", color: "var(--term-green)", label: locale === "ko" ? "상승" : "rising" };
    case "FALLING":
      return { glyph: "↘", color: "var(--term-red)", label: locale === "ko" ? "하락" : "falling" };
    case "FLAT":
      return { glyph: "→", color: "var(--term-amber)", label: locale === "ko" ? "정체" : "flat" };
    default:
      return {
        glyph: "·",
        color: "var(--term-dim)",
        label: locale === "ko" ? "데이터 부족" : "building",
      };
  }
}

// 하이브리드(asymptote) 드라이버 e1RM 추세 — paper asymptote-monitor-section의 terminal 대응.
// 드라이버별: 운동명 · 추세 글리프(↗/↘/→) · 이동평균값(kg) · 노출수. window는 헤더에 노출.
function AsymptoteMonitor({
  data,
  locale,
}: {
  data: AsymptoteMonitorResult;
  locale: "ko" | "en";
}) {
  const ko = locale === "ko";
  const row: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--v2-s-2)",
  };
  return (
    <div style={GOAL_PANEL}>
      <div className="v2-mono-label" style={{ ...row, justifyContent: "space-between" }}>
        <span style={{ color: "var(--term-dim)" }}>
          {ko ? "드라이버 e1RM 추세" : "driver e1RM trend"}
        </span>
        <span style={{ color: "var(--term-dim)" }}>
          {ko ? `${data.window}세션 이동평균` : `${data.window}-sess MA`}
        </span>
      </div>
      {data.drivers.map((driver) => {
        const meta = DRIVER_LABELS[driver.target];
        const t = trendGlyph(driver.trend, locale);
        return (
          <div key={driver.target} className="v2-mono-label" style={row}>
            <span
              role="img"
              aria-label={t.label}
              style={{ color: t.color, width: "1ch", textAlign: "center" }}
            >
              {t.glyph}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--term-fg)",
              }}
            >
              {ko ? meta.ko : meta.en}
            </span>
            <span style={{ color: t.color, whiteSpace: "nowrap" }}>
              {driver.latestMovingAvg !== null
                ? `${driver.latestMovingAvg.toFixed(1)}kg`
                : "—"}
            </span>
            <span style={{ color: "var(--term-dim)", whiteSpace: "nowrap" }}>
              {ko ? `${driver.exposures}노출` : `${driver.exposures}×`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function selectorStyle(color: string): CSSProperties {
  return {
    minHeight: "var(--v2-touch)",
    padding: "0 var(--v2-s-2)",
    background: "var(--term-inset)",
    border: "none",
    color,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function tabStyle(active: boolean): CSSProperties {
  return {
    minHeight: "var(--v2-touch)",
    padding: "0 var(--v2-s-2)",
    background: "transparent",
    border: "none",
    color: active ? "var(--term-cyan)" : "var(--term-dim)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
