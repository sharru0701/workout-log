"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";
import { Card } from "@/components/ui/card";
import { SessionCard } from "@/components/ui/session-card";
import type {
  HomeData,
  HomeLastSession,
  HomeStrengthItem,
  HomeVolumeTrendPoint,
  HomeQuickStats,
} from "@/lib/home/home-data-source";

// ─── Section 1: Program Status ──────────────────────────────────────

function ProgramStatusSection({ data }: { data: HomeData }) {
  const { planOverview, weeklySummary } = data;
  const hasPlan = planOverview.totalPlans > 0;
  const planHref = hasPlan ? APP_ROUTES.calendarHome : APP_ROUTES.programStore;

  if (!hasPlan) {
    return (
      <section>
        <Card as={Link} href={APP_ROUTES.programStore} padding="none">
          <div>
            <div>프로그램을 시작하세요</div>
            <p>
              프로그램 스토어에서 프로그램을 선택하면 오늘 운동이 자동으로 구성됩니다.
            </p>
            <span>프로그램 둘러보기</span>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <div style={{ marginBottom: "var(--space-md)" }}>
        <h2 style={{ font: "var(--font-section-title)", color: "var(--color-text)", margin: 0 }}>현재 프로그램</h2>
      </div>
      <Card as={Link} href={planHref} padding="md">
        <div style={{ font: "var(--font-card-title)", marginBottom: "2px" }}>{planOverview.highlightedPlanName ?? "플랜 없음"}</div>
        {planOverview.highlightedProgramName && (
          <div style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>{planOverview.highlightedProgramName}</div>
        )}
        <div style={{ display: "flex", gap: "var(--space-sm)", font: "var(--font-secondary)", color: "var(--color-text-muted)", marginBottom: "var(--space-md)" }}>
          {planOverview.lastPerformedAtLabel && (
            <span>마지막 수행 {planOverview.lastPerformedAtLabel}</span>
          )}
          <span>최근 7일 {weeklySummary.activeDays}일 운동</span>
        </div>
        <div aria-label="최근 7일 운동 활동" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--space-xs)", textAlign: "center" }}>
          {weeklySummary.days.map((day) => (
            <div
              key={day.key}
              aria-label={`${day.dateLabel} ${day.shortLabel} ${day.hasWorkout ? "운동함" : "휴식"}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}
            >
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{day.shortLabel}</span>
              <span aria-hidden="true" className={`activity-dot ${day.hasWorkout ? "is-active" : ""}`} />
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

// ─── Section 2: Today Session ──────────────────────────────────────

function TodaySessionSection({ data }: { data: HomeData }) {
  const { today, planOverview } = data;
  const hasTodayActivity = today.completedSets > 0;
  const hasPlan = planOverview.totalPlans > 0;

  const exercises = hasTodayActivity
    ? today.loggedExercises.map((ex) => ({ name: ex.name, summary: ex.bestSet }))
    : today.plannedExercises.map((ex) => ({ name: ex.name, role: ex.role, summary: ex.summary }));

  return (
    <section data-pull-refresh-trigger="true" style={{ marginBottom: "var(--space-xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--space-md)" }}>
        <h2 style={{ font: "var(--font-section-title)", color: "var(--color-text)", margin: 0 }}>오늘의 운동</h2>
        {hasTodayActivity && (
          <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>{today.completedSets}세트 완료</span>
        )}
      </div>
      <SessionCard
        variant="today"
        href={today.href}
        title={today.programName}
        meta={(!hasTodayActivity && today.plannedExercises.length === 0) || hasTodayActivity ? today.meta : undefined}
        exercises={exercises}
        ctaLabel={hasTodayActivity ? "이어서 하기" : hasPlan ? "운동 시작" : "프로그램 선택"}
      />
    </section>
  );
}

// ─── Section 3: Last Session ──────────────────────────────────────

function LastSessionSection({ session }: { session: HomeLastSession }) {
  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <div style={{ marginBottom: "var(--space-md)" }}>
        <h2 style={{ font: "var(--font-section-title)", color: "var(--color-text)", margin: 0 }}>지난 세션</h2>
      </div>
      <SessionCard
        variant="last"
        href={session.href}
        title={session.planName}
        date={session.date}
        totalSets={session.totalSets}
        totalVolume={session.totalVolume}
        exercises={session.exercises.map((ex) => ({
          name: ex.name,
          summary: ex.bestSet,
          weightDelta: ex.weightDelta,
        }))}
      />
    </section>
  );
}

// ─── Section 4: Strength Progress ──────────────────────────────────

function StrengthProgressSection({ items }: { items: HomeStrengthItem[] }) {
  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <div style={{ marginBottom: "var(--space-md)" }}>
        <h2 style={{ font: "var(--font-section-title)", color: "var(--color-text)", margin: 0 }}>스트렝스 진행</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {items.map((item) => {
          const href = item.exerciseId
            ? `${APP_ROUTES.stats1rm}?exerciseId=${encodeURIComponent(item.exerciseId)}`
            : `${APP_ROUTES.stats1rm}?exercise=${encodeURIComponent(item.exerciseName)}`;
          return (
            <Card as={Link} key={item.exerciseName} href={href} padding="md" className="metric-badge metric-1rm">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ font: "var(--font-card-title)" }}>{item.exerciseName}</div>
                  <div className="metric-kicker">Best e1RM</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="metric-value metric-1rm" style={{ fontSize: "1.2rem" }}>{item.bestE1rm}kg</div>
                  {item.improvement !== 0 ? (
                    <div className={`metric-trend ${metricTrendClassName(item.trend)}`}>
                      {item.trend === "up" ? "+" : ""}{item.improvement}kg
                    </div>
                  ) : (
                    <div className="metric-trend metric-trend--flat">-</div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ─── Section 5: Volume Trend ──────────────────────────────────────

function VolumeTrendSection({ points }: { points: HomeVolumeTrendPoint[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (points.length === 0) return null;

  const maxTonnage = Math.max(...points.map((p) => p.tonnage), 1);
  const selected = selectedIndex !== null ? points[selectedIndex] ?? null : null;

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <div style={{ marginBottom: "var(--space-md)" }}>
        <h2 style={{ font: "var(--font-section-title)", color: "var(--color-text)", margin: 0 }}>주간 볼륨</h2>
      </div>
      <Card padding="md">
        {selected && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)", padding: "var(--space-sm)", backgroundColor: "var(--color-surface-secondary)", borderRadius: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span style={{ fontWeight: 600 }}>{selected.label} 주</span>
              <span className={`label ${progressLabelClassForRatio(selected.tonnage / maxTonnage)} label-sm`}>
                {progressLabelText(selected.tonnage / maxTonnage)}
              </span>
            </span>
            <span className="metric-inline metric-volume">{formatVolume(selected.tonnage)}</span>
            <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>{selected.sets}세트 · {selected.reps}회</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "100px" }}>
          {points.map((point, i) => {
            const height = Math.max((point.tonnage / maxTonnage) * 100, 4);
            const ratio = point.tonnage / maxTonnage;
            const isLast = i === points.length - 1;
            const isSelected = selectedIndex === i;
            return (
              <button
                key={point.period}
                type="button"
                onClick={() => setSelectedIndex(isSelected ? null : i)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", background: "none", border: "none", cursor: "pointer", height: "100%", justifyContent: "flex-end" }}
              >
                <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>{formatVolume(point.tonnage)}</div>
                <div className="progress-bar-track" style={{ width: "100%", flex: "none" }}>
                  <div
                    className={`progress-bar-fill ${isSelected ? "progress-peak" : isLast ? "progress-high" : progressLabelClassForRatio(ratio)}`}
                    style={{ "--progress-bar-height": `${height}%` } as CSSProperties}
                  />
                </div>
                <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>{point.label}</div>
              </button>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

// ─── Section 6: Quick Stats ──────────────────────────────────────

function QuickStatsSection({ stats }: { stats: HomeQuickStats }) {
  const hasData = stats.totalSessions > 0;
  if (!hasData) return null;

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <div style={{ marginBottom: "var(--space-md)" }}>
        <h2 style={{ font: "var(--font-section-title)", color: "var(--color-text)", margin: 0 }}>요약 통계</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
        <Card padding="md" className="metric-badge metric-progress">
          <span className="metric-value">{stats.totalSessions}</span>
          <span className="metric-label">총 운동</span>
        </Card>
        <Card padding="md" className="metric-badge metric-volume">
          <span className="metric-value">{formatVolume(stats.totalVolume)}</span>
          <span className="metric-label">누적 볼륨</span>
        </Card>
        <Card padding="md" className="metric-badge metric-progress">
          <span className="metric-value">{stats.currentStreak}일</span>
          <span className="metric-label">연속 운동</span>
        </Card>
        <Card padding="md" className="metric-badge metric-reps">
          <span className="metric-value">{stats.thisMonthSessions}</span>
          <span className="metric-label">이번 달</span>
        </Card>
      </div>
    </section>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatVolume(kg: number): string {
  if (kg >= 1000) {
    const tons = kg / 1000;
    return tons % 1 === 0 ? `${tons}t` : `${tons.toFixed(1)}t`;
  }
  return `${kg}kg`;
}

function metricTrendClassName(trend: HomeStrengthItem["trend"]) {
  if (trend === "up") return "metric-trend--up";
  if (trend === "down") return "metric-trend--down";
  return "metric-trend--flat";
}

function progressLabelClassForRatio(ratio: number) {
  if (ratio >= 0.88) return "progress-peak";
  if (ratio >= 0.68) return "progress-high";
  if (ratio >= 0.42) return "progress-medium";
  return "progress-low";
}

function progressLabelText(ratio: number) {
  if (ratio >= 0.88) return "피크";
  if (ratio >= 0.68) return "고강도";
  if (ratio >= 0.42) return "중간";
  return "기초";
}

// ─── Main Dashboard ──────────────────────────────────────────────

export function HomeDashboard({ data }: { data: HomeData }) {
  return (
    <div>
      <ProgramStatusSection data={data} />
      <TodaySessionSection data={data} />
      {data.lastSession && <LastSessionSection session={data.lastSession} />}
      <StrengthProgressSection items={data.strengthProgress} />
      <VolumeTrendSection points={data.volumeTrend} />
      <QuickStatsSection stats={data.quickStats} />
    </div>
  );
}
