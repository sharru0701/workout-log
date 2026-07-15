"use client";

import { type CSSProperties } from "react";
import { useLocale } from "@/components/locale-provider";
import {
  TermBadge,
  TermProgress,
  TermSparkline,
} from "@/components/v2/terminal";
import type { HomeData } from "@/lib/home/home-data-source";
import type { AppLocale } from "@/lib/i18n/messages";
import { isHomeWorkoutComplete } from "@/widgets/home-dashboard/home-status";

// terminal(ironlog) home 뷰 — paper V2HomeDashboard의 terminal 대응(P-home).
// 앱 오픈 랜딩: streak(gold)·주간 day 스트립·resume/next CTA·volume 스파크라인·
// strength·recent. 동일 HomeData를 공유하고 표현만 TUI로. 프리미티브 총동원.
// TermShell ViewPane 안 렌더라 외곽 패딩 없음.

function formatKg(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
  return `${Math.round(v)}kg`;
}

const PANEL: CSSProperties = {
  padding: "var(--v2-s-3)",
  background: "var(--term-panel)",
  boxShadow: "inset 0 0 0 1px var(--term-line-box)",
  borderRadius: "var(--v2-r-2)",
};

export function HomeTuiView({ data }: { data: HomeData }) {
  const { copy, locale } = useLocale();
  const ko = locale === "ko";
  const {
    quickStats,
    weeklySummary,
    today,
    strengthProgress,
    volumeTrend,
    recentSessions,
    goal,
    goalMetrics,
  } = data;

  const volSeries = volumeTrend.map((p) => p.tonnage).filter((v) => v > 0);
  const resumeLabel = isHomeWorkoutComplete(today)
    ? copy.home.protocol.logMore
    : today.hasPlan
      ? ko ? "시작" : "start"
      : ko ? "플랜 선택" : "select plan";

  return (
    <section
      aria-label={ko ? "홈" : "Home"}
      style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-4)" }}
    >
      {/* 퀵 스탯 readout */}
      <div
        className="v2-mono-label"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--v2-s-1) var(--v2-s-3)",
        }}
      >
        <Stat label={ko ? "총 세션" : "sessions"} value={String(quickStats.totalSessions)} />
        <Stat
          label={ko ? "스트릭" : "streak"}
          value={`${quickStats.currentStreak}${ko ? "일" : "d"}`}
          tone="gold"
        />
        <Stat label={ko ? "총 볼륨" : "volume"} value={formatKg(quickStats.totalVolume)} />
        <Stat label={ko ? "이번달" : "month"} value={String(quickStats.thisMonthSessions)} />
      </div>

      {/* 주간 day 스트립 */}
      <div style={PANEL}>
        <div
          className="v2-mono-label"
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "var(--term-dim)",
            marginBottom: "var(--v2-s-2)",
          }}
        >
          <span>{ko ? "이번 주" : "this week"}</span>
          <span style={{ color: "var(--term-green)" }}>
            {weeklySummary.activeDays}/{weeklySummary.days.length}
          </span>
        </div>
        <div
          className="v2-font-num"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${weeklySummary.days.length}, 1fr)`,
            textAlign: "center",
            gap: "var(--v2-s-1)",
          }}
        >
          {weeklySummary.days.map((d) => (
            <div key={d.key} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
              <span style={{ color: "var(--term-dim)", fontSize: "var(--v2-t-12)" }}>
                {d.shortLabel}
              </span>
              <span
                aria-hidden
                style={{
                  color: d.hasWorkout
                    ? "var(--term-green)"
                    : d.isToday
                      ? "var(--term-amber)"
                      : "var(--term-ghost)",
                }}
              >
                {d.hasWorkout ? "█" : d.isToday ? "▮" : "·"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 오늘 / resume CTA */}
      <a href={today.href} style={{ ...PANEL, textDecoration: "none", display: "block" }}>
        <div
          className="v2-mono-label"
          style={{
            color: "var(--term-fg)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {today.headline}
        </div>
        <div
          className="v2-mono-label"
          style={{
            color: "var(--term-dim)",
            marginTop: "var(--v2-s-1)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {today.meta}
        </div>
        <div
          className="v2-mono-label"
          style={{ color: "var(--term-amber)", marginTop: "var(--v2-s-2)" }}
        >
          [▶ {resumeLabel}]
        </div>
      </a>

      {/* 오늘의 운동 목록 — paper "오늘의 세션" 카드 운동 리스트의 terminal 대응.
          운동별: 인덱스 · 운동명 · 세트 요약(summary or N sets) · [MAIN] 배지. */}
      {today.hasPlan && today.plannedExercises.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
          <div
            className="v2-mono-label"
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--term-dim)",
            }}
          >
            <span>{ko ? "오늘 운동" : "today"}</span>
            <span style={{ color: "var(--term-cyan)" }}>
              {today.completedSets}/{today.totalPlannedSets}
              {ko ? " 세트" : " sets"}
            </span>
          </div>
          {today.plannedExercises.map((ex, i) => (
            <div
              key={`${ex.exerciseId ?? ex.name}-${i}`}
              className="v2-mono-label"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--v2-s-2)",
              }}
            >
              <span
                style={{ color: "var(--term-dim)", whiteSpace: "nowrap" }}
              >
                {String(i + 1).padStart(2, "0")}
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
                {ex.name}
              </span>
              <span style={{ color: "var(--term-dim)", whiteSpace: "nowrap" }}>
                {ex.summary || `${ex.totalSets}${ko ? "세트" : "x"}`}
              </span>
              {ex.role === "MAIN" ? (
                <TermBadge tone="accent">{ko ? "메인" : "MAIN"}</TermBadge>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* 볼륨 추세 스파크라인 */}
      {volSeries.length > 1 ? (
        <div
          className="v2-mono-label"
          style={{ display: "flex", alignItems: "center", gap: "var(--v2-s-2)" }}
        >
          <span style={{ color: "var(--term-dim)" }}>{ko ? "볼륨" : "vol"}</span>
          <TermSparkline data={volSeries} width={20} tone="accent" markPeak />
          <span style={{ color: "var(--term-amber)", marginLeft: "auto" }}>
            {formatKg(volumeTrend.at(-1)?.tonnage ?? 0)}
          </span>
        </div>
      ) : null}

      {/* 1RM strength 진행 */}
      {strengthProgress.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
          <span className="v2-mono-label" style={{ color: "var(--term-dim)" }}>
            1RM
          </span>
          {strengthProgress.slice(0, 4).map((s) => (
            <div
              key={s.exerciseId ?? s.exerciseName}
              className="v2-mono-label"
              style={{ display: "flex", alignItems: "center", gap: "var(--v2-s-2)" }}
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
                {s.exerciseName}
              </span>
              <span aria-hidden style={{ color: trendColor(s.trend) }}>
                {trendGlyph(s.trend)}
              </span>
              <span style={{ color: "var(--term-cyan)", whiteSpace: "nowrap" }}>
                {s.bestE1rm}kg
              </span>
              <TermBadge tone={s.improvement > 0 ? "success" : "dim"}>
                {s.improvement > 0 ? `+${s.improvement.toFixed(1)}` : s.improvement.toFixed(1)}
              </TermBadge>
            </div>
          ))}
        </div>
      ) : null}

      {/* 홈 골 섹션 — paper HomeGoalSection의 terminal 대응. goal별 분기:
          근력/파워→Big3 토탈 · 근비대→근육군 볼륨 바(TermProgress) · 지구력→운동 시간.
          paper와 동일 데이터(data.goal / data.goalMetrics) 재사용. general은 표시 안 함. */}
      <GoalMetric goal={goal} metrics={goalMetrics} locale={locale} />

      {/* 최근 세션 */}
      {recentSessions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
          <span className="v2-mono-label" style={{ color: "var(--term-dim)" }}>
            {ko ? "최근" : "recent"}
          </span>
          {recentSessions.slice(0, 3).map((r) => (
            <a
              key={r.id}
              href={r.href}
              className="v2-mono-label"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--v2-s-2)",
                minHeight: "var(--v2-touch)",
                textDecoration: "none",
              }}
            >
              <span style={{ color: "var(--term-green)" }}>✓</span>
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
                {r.title}
              </span>
              <span style={{ color: "var(--term-dim)", whiteSpace: "nowrap" }}>
                {r.subtitle}
              </span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
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

// 홈 골 섹션 본문 — paper GoalSection/HomeGoalSection의 terminal 대응.
// goal별 분기: 근력/파워→Big3 토탈, 근비대→근육군 볼륨 바, 지구력→운동 시간.
// general(또는 해당 metric 없음)은 null.
function GoalMetric({
  goal,
  metrics,
  locale,
}: {
  goal: HomeData["goal"];
  metrics: HomeData["goalMetrics"];
  locale: AppLocale;
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

function trendGlyph(t: "up" | "down" | "flat"): string {
  return t === "up" ? "▲" : t === "down" ? "▼" : "=";
}
function trendColor(t: "up" | "down" | "flat"): string {
  return t === "up"
    ? "var(--term-green)"
    : t === "down"
      ? "var(--term-red)"
      : "var(--term-dim)";
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
      <span style={{ color: tone === "gold" ? "var(--term-gold)" : "var(--term-cyan)" }}>
        {value}
      </span>
    </span>
  );
}
