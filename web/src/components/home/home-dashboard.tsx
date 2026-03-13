"use client";

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
      <section className="hd-section">
        <Card as={Link} href={APP_ROUTES.programStore} padding="none" className="hd-program-card">
          <div className="hd-program-empty">
            <div className="hd-program-empty-title">프로그램을 시작하세요</div>
            <p className="hd-program-empty-copy">
              프로그램 스토어에서 프로그램을 선택하면 오늘 운동이 자동으로 구성됩니다.
            </p>
            <span className="hd-program-empty-action">프로그램 둘러보기</span>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="hd-section">
      <div className="hd-section-head">
        <h2 className="hd-section-title">현재 프로그램</h2>
      </div>
      <Card as={Link} href={planHref} padding="none" className="hd-program-card">
        <div className="hd-program-name">{planOverview.highlightedPlanName ?? "플랜 없음"}</div>
        {planOverview.highlightedProgramName && (
          <div className="hd-program-base">{planOverview.highlightedProgramName}</div>
        )}
        <div className="hd-program-meta-row">
          {planOverview.lastPerformedAtLabel && (
            <span className="hd-program-meta">마지막 수행 {planOverview.lastPerformedAtLabel}</span>
          )}
          <span className="hd-program-meta">최근 7일 {weeklySummary.activeDays}일 운동</span>
        </div>
        <div className="hd-week-strip" aria-label="최근 7일 운동 활동">
          {weeklySummary.days.map((day) => (
            <div
              key={day.key}
              className={`hd-week-day${day.hasWorkout ? " is-active" : ""}${day.isToday ? " is-today" : ""}`}
              aria-label={`${day.dateLabel} ${day.shortLabel} ${day.hasWorkout ? "운동함" : "휴식"}`}
            >
              <span className="hd-week-day-label">{day.shortLabel}</span>
              <span className="hd-week-day-dot" aria-hidden="true" />
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
    <section className="hd-section" data-pull-refresh-trigger="true">
      <div className="hd-section-head">
        <h2 className="hd-section-title">오늘의 운동</h2>
        {hasTodayActivity && (
          <span className="hd-section-action">{today.completedSets}세트 완료</span>
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
    <section className="hd-section">
      <div className="hd-section-head">
        <h2 className="hd-section-title">지난 세션</h2>
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
    <section className="hd-section">
      <div className="hd-section-head">
        <h2 className="hd-section-title">스트렝스 진행</h2>
      </div>
      <div className="hd-strength-grid">
        {items.map((item) => {
          const href = item.exerciseId
            ? `${APP_ROUTES.stats1rm}?exerciseId=${encodeURIComponent(item.exerciseId)}`
            : `${APP_ROUTES.stats1rm}?exercise=${encodeURIComponent(item.exerciseName)}`;
          return (
            <Card as={Link} key={item.exerciseName} href={href} padding="none" className="hd-strength-card">
              <div className="hd-strength-name">{item.exerciseName}</div>
              <div className="hd-strength-value">{item.bestE1rm}kg</div>
              <div className="hd-strength-label">Best e1RM</div>
              {item.improvement !== 0 ? (
                <div className={`hd-strength-trend hd-strength-trend--${item.trend}`}>
                  {item.trend === "up" ? "+" : ""}{item.improvement}kg
                </div>
              ) : (
                <div className="hd-strength-trend hd-strength-trend--flat">-</div>
              )}
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
    <section className="hd-section">
      <div className="hd-section-head">
        <h2 className="hd-section-title">주간 볼륨</h2>
      </div>
      <Card padding="none" className="hd-volume-card">
        {selected && (
          <div className="hd-volume-detail">
            <span className="hd-volume-detail-label">{selected.label} 주</span>
            <span className="hd-volume-detail-value">{formatVolume(selected.tonnage)}</span>
            <span className="hd-volume-detail-sub">{selected.sets}세트 · {selected.reps}회</span>
          </div>
        )}
        <div className="hd-volume-bars">
          {points.map((point, i) => {
            const height = Math.max((point.tonnage / maxTonnage) * 100, 4);
            const isLast = i === points.length - 1;
            const isSelected = selectedIndex === i;
            return (
              <button
                key={point.period}
                type="button"
                className={`hd-volume-col${isSelected ? " is-selected" : ""}`}
                onClick={() => setSelectedIndex(isSelected ? null : i)}
              >
                <div className="hd-volume-value">{formatVolume(point.tonnage)}</div>
                <div className="hd-volume-bar-track">
                  <div
                    className={`hd-volume-bar${isLast ? " hd-volume-bar--current" : ""}${isSelected ? " hd-volume-bar--selected" : ""}`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <div className="hd-volume-label">{point.label}</div>
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
    <section className="hd-section">
      <div className="hd-section-head">
        <h2 className="hd-section-title">요약 통계</h2>
      </div>
      <div className="hd-stats-grid">
        <Card padding="none" className="hd-stat-chip">
          <span className="hd-stat-chip-value">{stats.totalSessions}</span>
          <span className="hd-stat-chip-label">총 운동</span>
        </Card>
        <Card padding="none" className="hd-stat-chip">
          <span className="hd-stat-chip-value">{formatVolume(stats.totalVolume)}</span>
          <span className="hd-stat-chip-label">누적 볼륨</span>
        </Card>
        <Card padding="none" className="hd-stat-chip">
          <span className="hd-stat-chip-value">{stats.currentStreak}일</span>
          <span className="hd-stat-chip-label">연속 운동</span>
        </Card>
        <Card padding="none" className="hd-stat-chip">
          <span className="hd-stat-chip-value">{stats.thisMonthSessions}</span>
          <span className="hd-stat-chip-label">이번 달</span>
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

// ─── Main Dashboard ──────────────────────────────────────────────

export function HomeDashboard({ data }: { data: HomeData }) {
  return (
    <div className="hd-layout">
      <a
        href="/ios-top-chrome-minimal.html"
        style={{
          display: "block",
          padding: "0.7rem 1rem",
          marginBottom: "0.5rem",
          borderRadius: "0.75rem",
          border: "1px solid rgba(85,212,205,0.3)",
          background: "rgba(85,212,205,0.08)",
          color: "#55d4cd",
          fontSize: "0.85rem",
          fontWeight: 600,
          textDecoration: "none",
          textAlign: "center",
        }}
      >
        🔍 Safari 상단 투명화 테스트 페이지 열기
      </a>
      <ProgramStatusSection data={data} />
      <TodaySessionSection data={data} />
      {data.lastSession && <LastSessionSection session={data.lastSession} />}
      <StrengthProgressSection items={data.strengthProgress} />
      <VolumeTrendSection points={data.volumeTrend} />
      <QuickStatsSection stats={data.quickStats} />
    </div>
  );
}
