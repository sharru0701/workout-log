"use client";

import { useState } from "react";
import Link from "next/link";
import { PrimaryButton } from "@/components/ui/primary-button";
import { APP_ROUTES } from "@/lib/app-routes";
import type {
  HomeData,
  HomeLastSession,
  HomeStrengthItem,
  HomeTodayLoggedExercise,
  HomeVolumeTrendPoint,
  HomeQuickStats,
  HomeTodayExercise,
} from "@/lib/home/home-data-source";

// ─── Section 1: Program Status ──────────────────────────────────────

function ProgramStatusSection({ data }: { data: HomeData }) {
  const { planOverview, weeklySummary } = data;
  const hasPlan = planOverview.totalPlans > 0;
  const planHref = hasPlan ? APP_ROUTES.calendarHome : APP_ROUTES.programStore;

  if (!hasPlan) {
    return (
      <section className="hd-section">
        <Link className="hd-program-card" href={APP_ROUTES.programStore}>
          <div className="hd-program-empty">
            <div className="hd-program-empty-title">프로그램을 시작하세요</div>
            <p className="hd-program-empty-copy">
              프로그램 스토어에서 프로그램을 선택하면 오늘 운동이 자동으로 구성됩니다.
            </p>
            <span className="hd-program-empty-action">프로그램 둘러보기</span>
          </div>
        </Link>
      </section>
    );
  }

  return (
    <section className="hd-section">
      <div className="hd-section-head">
        <h2 className="hd-section-title">현재 프로그램</h2>
      </div>
      <Link className="hd-program-card" href={planHref}>
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
      </Link>
    </section>
  );
}

// ─── Section 2: Today Session ──────────────────────────────────────

function TodayExercisePreview({ exercises }: { exercises: HomeTodayExercise[] }) {
  if (exercises.length === 0) return null;

  const mainExercises = exercises.filter((e) => e.role === "MAIN");
  const assistExercises = exercises.filter((e) => e.role !== "MAIN");

  return (
    <div className="hd-today-exercises">
      {mainExercises.length > 0 && (
        <div className="hd-today-exercise-group">
          {mainExercises.map((ex) => (
            <div key={ex.name} className="hd-today-exercise hd-today-exercise--main">
              <span className="hd-today-exercise-name">{ex.name}</span>
              <span className="hd-today-exercise-summary">{ex.summary}</span>
            </div>
          ))}
        </div>
      )}
      {assistExercises.length > 0 && (
        <div className="hd-today-exercise-group">
          {assistExercises.slice(0, 3).map((ex) => (
            <div key={ex.name} className="hd-today-exercise">
              <span className="hd-today-exercise-name">{ex.name}</span>
              <span className="hd-today-exercise-summary">{ex.summary}</span>
            </div>
          ))}
          {assistExercises.length > 3 && (
            <div className="hd-today-exercise hd-today-exercise--more">
              +{assistExercises.length - 3}개 보조 운동
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function mapTodayLoggedExercises(exercises: HomeTodayLoggedExercise[]) {
  return exercises.map((exercise) => ({
    name: exercise.name,
    detail: exercise.bestSet,
  }));
}

function TodaySessionSection({ data }: { data: HomeData }) {
  const { today, planOverview } = data;
  const hasTodayActivity = today.completedSets > 0;
  const hasPlan = planOverview.totalPlans > 0;
  const hasPlannedExercises = today.plannedExercises.length > 0;

  return (
    <section className="hd-section" data-pull-refresh-trigger="true">
      <div className="hd-section-head">
        <h2 className="hd-section-title">오늘의 운동</h2>
        {hasTodayActivity && (
          <span className="hd-section-action">{today.completedSets}세트 완료</span>
        )}
      </div>
      <Link className="hd-today-card" href={today.href}>
        <div className="hd-today-program">{today.programName}</div>

        {!hasTodayActivity && hasPlannedExercises && (
          <TodayExercisePreview exercises={today.plannedExercises} />
        )}

        {hasTodayActivity && (
          <>
            <p className="hd-today-meta">{today.meta}</p>
            <SessionExerciseList exercises={mapTodayLoggedExercises(today.loggedExercises)} />
          </>
        )}

        {!hasTodayActivity && !hasPlannedExercises && (
          <p className="hd-today-meta">{today.meta}</p>
        )}

        <PrimaryButton as="div" variant="primary" size="lg" fullWidth interactive={false} className="hd-today-cta">
          <span className="hd-today-cta-text">
            {hasTodayActivity ? "이어서 하기" : hasPlan ? "운동 시작" : "프로그램 선택"}
          </span>
          <svg className="hd-today-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </PrimaryButton>
      </Link>
    </section>
  );
}

// ─── Section 3: Last Session ──────────────────────────────────────

function WeightDeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const isUp = delta > 0;
  return (
    <span className={`hd-last-delta ${isUp ? "hd-last-delta--up" : "hd-last-delta--down"}`}>
      {isUp ? "+" : ""}{delta}kg
    </span>
  );
}

function SessionExerciseList({
  exercises,
}: {
  exercises: Array<{ name: string; detail: string; weightDelta?: number | null }>;
}) {
  if (exercises.length === 0) return null;

  return (
    <div className="hd-last-exercises">
      {exercises.slice(0, 4).map((exercise) => (
        <div key={exercise.name} className="hd-last-exercise">
          <span className="hd-last-exercise-name">{exercise.name}</span>
          <span className="hd-last-exercise-right">
            {exercise.weightDelta !== undefined && exercise.weightDelta !== null && (
              <WeightDeltaBadge delta={exercise.weightDelta} />
            )}
            <span className="hd-last-exercise-detail">{exercise.detail}</span>
          </span>
        </div>
      ))}
      {exercises.length > 4 && (
        <div className="hd-last-exercise hd-last-exercise--more">
          +{exercises.length - 4}개 더
        </div>
      )}
    </div>
  );
}

function LastSessionSection({ session }: { session: HomeLastSession }) {
  return (
    <section className="hd-section">
      <div className="hd-section-head">
        <h2 className="hd-section-title">지난 세션</h2>
      </div>
      <Link className="hd-last-card" href={session.href}>
        <div className="hd-last-top">
          <div>
            <div className="hd-last-plan">{session.planName}</div>
            <div className="hd-last-date">{session.date}</div>
          </div>
          <div className="hd-last-stats">
            <span className="hd-last-stat">{session.totalSets}세트</span>
            <span className="hd-last-stat-sep">/</span>
            <span className="hd-last-stat">{formatVolume(session.totalVolume)}</span>
          </div>
        </div>
        <SessionExerciseList
          exercises={session.exercises.map((exercise) => ({
            name: exercise.name,
            detail: exercise.bestSet,
            weightDelta: exercise.weightDelta,
          }))}
        />
      </Link>
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
            <Link key={item.exerciseName} className="hd-strength-card" href={href}>
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
            </Link>
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
      <div className="hd-volume-card">
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
      </div>
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
        <div className="hd-stat-chip">
          <span className="hd-stat-chip-value">{stats.totalSessions}</span>
          <span className="hd-stat-chip-label">총 운동</span>
        </div>
        <div className="hd-stat-chip">
          <span className="hd-stat-chip-value">{formatVolume(stats.totalVolume)}</span>
          <span className="hd-stat-chip-label">누적 볼륨</span>
        </div>
        <div className="hd-stat-chip">
          <span className="hd-stat-chip-value">{stats.currentStreak}일</span>
          <span className="hd-stat-chip-label">연속 운동</span>
        </div>
        <div className="hd-stat-chip">
          <span className="hd-stat-chip-value">{stats.thisMonthSessions}</span>
          <span className="hd-stat-chip-label">이번 달</span>
        </div>
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
      <ProgramStatusSection data={data} />
      <TodaySessionSection data={data} />
      {data.lastSession && <LastSessionSection session={data.lastSession} />}
      <StrengthProgressSection items={data.strengthProgress} />
      <VolumeTrendSection points={data.volumeTrend} />
      <QuickStatsSection stats={data.quickStats} />
    </div>
  );
}
