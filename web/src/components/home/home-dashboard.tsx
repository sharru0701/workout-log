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
    <section>
      <div>
        <h2>현재 프로그램</h2>
      </div>
      <Card as={Link} href={planHref} padding="none">
        <div>{planOverview.highlightedPlanName ?? "플랜 없음"}</div>
        {planOverview.highlightedProgramName && (
          <div>{planOverview.highlightedProgramName}</div>
        )}
        <div>
          {planOverview.lastPerformedAtLabel && (
            <span>마지막 수행 {planOverview.lastPerformedAtLabel}</span>
          )}
          <span>최근 7일 {weeklySummary.activeDays}일 운동</span>
        </div>
        <div aria-label="최근 7일 운동 활동">
          {weeklySummary.days.map((day) => (
            <div
              key={day.key}
              aria-label={`${day.dateLabel} ${day.shortLabel} ${day.hasWorkout ? "운동함" : "휴식"}`}
            >
              <span>{day.shortLabel}</span>
              <span aria-hidden="true" />
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
    <section data-pull-refresh-trigger="true">
      <div>
        <h2>오늘의 운동</h2>
        {hasTodayActivity && (
          <span>{today.completedSets}세트 완료</span>
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
    <section>
      <div>
        <h2>지난 세션</h2>
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
    <section>
      <div>
        <h2>스트렝스 진행</h2>
      </div>
      <div>
        {items.map((item) => {
          const href = item.exerciseId
            ? `${APP_ROUTES.stats1rm}?exerciseId=${encodeURIComponent(item.exerciseId)}`
            : `${APP_ROUTES.stats1rm}?exercise=${encodeURIComponent(item.exerciseName)}`;
          return (
            <Card as={Link} key={item.exerciseName} href={href} padding="none">
              <div>{item.exerciseName}</div>
              <div>{item.bestE1rm}kg</div>
              <div>Best e1RM</div>
              {item.improvement !== 0 ? (
                <div>
                  {item.trend === "up" ? "+" : ""}{item.improvement}kg
                </div>
              ) : (
                <div>-</div>
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
    <section>
      <div>
        <h2>주간 볼륨</h2>
      </div>
      <Card padding="none">
        {selected && (
          <div>
            <span>{selected.label} 주</span>
            <span>{formatVolume(selected.tonnage)}</span>
            <span>{selected.sets}세트 · {selected.reps}회</span>
          </div>
        )}
        <div>
          {points.map((point, i) => {
            const height = Math.max((point.tonnage / maxTonnage) * 100, 4);
            const isLast = i === points.length - 1;
            const isSelected = selectedIndex === i;
            return (
              <button
                key={point.period}
                type="button"
                onClick={() => setSelectedIndex(isSelected ? null : i)}
              >
                <div>{formatVolume(point.tonnage)}</div>
                <div>
                  <div
                    style={{ height: `${height}%` }}
                  />
                </div>
                <div>{point.label}</div>
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
    <section>
      <div>
        <h2>요약 통계</h2>
      </div>
      <div>
        <Card padding="none">
          <span>{stats.totalSessions}</span>
          <span>총 운동</span>
        </Card>
        <Card padding="none">
          <span>{formatVolume(stats.totalVolume)}</span>
          <span>누적 볼륨</span>
        </Card>
        <Card padding="none">
          <span>{stats.currentStreak}일</span>
          <span>연속 운동</span>
        </Card>
        <Card padding="none">
          <span>{stats.thisMonthSessions}</span>
          <span>이번 달</span>
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
