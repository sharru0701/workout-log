"use client";

import type { CSSProperties } from "react";
import { memo, useMemo, useState } from "react";
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

function todayDateString(): string {
  const now = new Date();
  return now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

// ─── Editorial section heading ────────────────────────────────────

function SectionLabel({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: "var(--space-sm)" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "1px" }}>
        {eyebrow}
      </div>
      <h2 style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.2px", color: "var(--color-text)", margin: 0 }}>
        {title}
      </h2>
    </div>
  );
}

// ─── Section 0: Editorial Date Header ────────────────────────────

const EditorialDateHeader = memo(function EditorialDateHeader({ data }: { data: HomeData }) {
  const { weeklySummary } = data;
  return (
    <div style={{
      marginBottom: "var(--space-xl)",
      paddingBottom: "var(--space-md)",
      borderBottom: "1px solid var(--color-border)",
    }}>
      <div style={{
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--color-action)",
        marginBottom: "4px",
      }}>
        Today · {todayDateString()}
      </div>
      <h1 style={{
        fontSize: "28px",
        fontWeight: 800,
        letterSpacing: "-0.5px",
        color: "var(--color-text)",
        margin: 0,
      }}>
        훈련 대시보드
      </h1>
      <p style={{
        fontSize: "13px",
        color: "var(--color-text-muted)",
        marginTop: "4px",
        lineHeight: 1.5,
      }}>
        최근 {weeklySummary.activeDays}일간 운동 활성일 기반 요약입니다.
      </p>
    </div>
  );
});

// ─── Section 1: Today Session ─────────────────────────────────────

const TodaySessionSection = memo(function TodaySessionSection({ data }: { data: HomeData }) {
  const { today, planOverview } = data;
  const hasTodayActivity = today.completedSets > 0;
  const hasPlan = planOverview.totalPlans > 0;

  const exercises = hasTodayActivity
    ? today.loggedExercises.map((ex) => ({ name: ex.name, summary: ex.bestSet }))
    : today.plannedExercises.map((ex) => ({ name: ex.name, role: ex.role, summary: ex.summary }));

  return (
    <section data-pull-refresh-trigger="true" style={{ marginBottom: "var(--space-xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-action)", marginBottom: "1px" }}>
            Now
          </div>
          <h2 style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.2px", color: "var(--color-text)", margin: 0 }}>
            오늘의 운동
          </h2>
        </div>
        {hasTodayActivity && (
          <span style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--color-success)",
            background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-success) 30%, transparent)",
            padding: "3px 10px",
            borderRadius: "20px",
            letterSpacing: "0.04em",
          }}>
            {today.completedSets}세트 완료
          </span>
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
});

// ─── Section 2: Quick Stats Bento ────────────────────────────────

const QuickStatsBento = memo(function QuickStatsBento({ stats }: { stats: HomeQuickStats }) {
  if (stats.totalSessions === 0) return null;

  const cells = [
    { label: "총 운동", value: String(stats.totalSessions), unit: "", color: "var(--text-metric-sets)" },
    { label: "누적 볼륨", value: stats.totalVolume >= 1000 ? (stats.totalVolume / 1000).toFixed(1) : String(stats.totalVolume), unit: stats.totalVolume >= 1000 ? "t" : "kg", color: "var(--text-metric-weight)" },
    { label: "연속 운동", value: String(stats.currentStreak), unit: "일", color: "var(--color-action)" },
    { label: "이번 달", value: String(stats.thisMonthSessions), unit: "회", color: "var(--text-metric-reps)" },
  ];

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <SectionLabel eyebrow="Overview" title="요약 통계" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
        {cells.map((c) => (
          <div key={c.label} style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 1px 3px var(--shadow-color-soft)",
          }}>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: c.color, marginBottom: "6px" }}>
              {c.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
              <span style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-1px", color: "var(--color-text)", lineHeight: 1 }}>
                {c.value}
              </span>
              {c.unit && <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)" }}>{c.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

// ─── Section 3: Program Status ────────────────────────────────────

const ProgramStatusSection = memo(function ProgramStatusSection({ data }: { data: HomeData }) {
  const { planOverview, weeklySummary } = data;
  const hasPlan = planOverview.totalPlans > 0;
  const planHref = hasPlan ? APP_ROUTES.calendarHome : APP_ROUTES.programStore;

  if (!hasPlan) {
    return (
      <section style={{ marginBottom: "var(--space-xl)" }}>
        <Card as={Link} href={APP_ROUTES.programStore} padding="none">
          <div>
            <div>프로그램을 시작하세요</div>
            <p>프로그램 스토어에서 프로그램을 선택하면 오늘 운동이 자동으로 구성됩니다.</p>
            <span>프로그램 둘러보기</span>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <SectionLabel eyebrow="Current Focus" title="진행 중인 플랜" />
      <Card as={Link} href={planHref} padding="md" data-card-tone="accent">
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-action)", marginBottom: "var(--space-xs)" }}>
          Active Plan
        </div>
        <div style={{ font: "var(--font-page-title)", color: "var(--text-plan-name)", marginBottom: "2px", letterSpacing: "-0.3px" }}>
          {planOverview.highlightedPlanName ?? "플랜 없음"}
        </div>
        {planOverview.highlightedProgramName && (
          <div style={{ font: "var(--font-secondary)", color: "var(--text-session-name)", marginBottom: "var(--space-md)" }}>
            {planOverview.highlightedProgramName}
          </div>
        )}
        {planOverview.lastPerformedAtLabel && (
          <div style={{ font: "var(--font-secondary)", color: "var(--text-meta)", marginBottom: "var(--space-md)" }}>
            마지막 수행 {planOverview.lastPerformedAtLabel}
          </div>
        )}
        {/* Weekly activity dots */}
        <div style={{ marginTop: "var(--space-sm)", paddingTop: "var(--space-sm)", borderTop: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>
            최근 7일 활동
          </div>
          <div aria-label="최근 7일 운동 활동" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--space-xs)", textAlign: "center" }}>
            {weeklySummary.days.map((day) => (
              <div
                key={day.key}
                aria-label={`${day.dateLabel} ${day.shortLabel} ${day.hasWorkout ? "운동함" : "휴식"}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}
              >
                <span style={{ fontSize: "10px", color: "var(--text-session-day)" }}>{day.shortLabel}</span>
                <span aria-hidden="true" className={`activity-dot ${day.hasWorkout ? "is-active" : ""}`} />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
});

// ─── Section 4: Last Session ──────────────────────────────────────

const LastSessionSection = memo(function LastSessionSection({ session }: { session: HomeLastSession }) {
  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <SectionLabel eyebrow="History" title="지난 세션" />
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
});

// ─── Section 5: Strength Progress ────────────────────────────────

const StrengthProgressSection = memo(function StrengthProgressSection({ items }: { items: HomeStrengthItem[] }) {
  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <SectionLabel eyebrow="Strength" title="스트렝스 진행" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {items.map((item) => {
          const href = item.exerciseId
            ? `${APP_ROUTES.statsHome}?exerciseId=${encodeURIComponent(item.exerciseId)}`
            : `${APP_ROUTES.statsHome}?exercise=${encodeURIComponent(item.exerciseName)}`;
          return (
            <Card as={Link} key={item.exerciseName} href={href} padding="md" className="metric-badge metric-1rm">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ font: "var(--font-card-title)", color: "var(--text-exercise-name)" }}>{item.exerciseName}</div>
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
});

// ─── Section 6: Volume Trend ──────────────────────────────────────

function VolumeTrendSection({ points }: { points: HomeVolumeTrendPoint[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const maxTonnage = useMemo(() => Math.max(...points.map((p) => p.tonnage), 1), [points]);

  if (points.length === 0) return null;

  const selected = selectedIndex !== null ? points[selectedIndex] ?? null : null;
  const CHART_BAR_HEIGHT_PX = 82;

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <SectionLabel eyebrow="Volume" title="최근 세션 볼륨" />
      <Card padding="md">
        {selected && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)", padding: "var(--space-sm)", backgroundColor: "var(--color-surface-secondary)", borderRadius: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span style={{ fontWeight: 600, color: "var(--text-session-context)" }}>{selected.label}</span>
              <span className={`label ${progressLabelClassForRatio(selected.tonnage / maxTonnage)} label-sm`}>
                {progressLabelText(selected.tonnage / maxTonnage)}
              </span>
            </span>
            <span className="metric-inline metric-volume">{formatVolume(selected.tonnage)}</span>
            <span style={{ font: "var(--font-secondary)", fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: "var(--text-metric-sets)" }}>{selected.sets}</span>
              <span style={{ color: "var(--text-hint)" }}>세트 · </span>
              <span style={{ color: "var(--text-metric-reps)" }}>{selected.reps}</span>
              <span style={{ color: "var(--text-hint)" }}>회</span>
            </span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "136px" }}>
          {points.map((point, i) => {
            const normalized = point.tonnage <= 0 ? 0 : Math.sqrt(point.tonnage / maxTonnage);
            const height = point.tonnage <= 0 ? 6 : Math.max(18, normalized * 100);
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
                <div style={{ fontSize: "10px", color: "var(--text-metric-volume)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatVolume(point.tonnage)}</div>
                <div className="progress-bar-track" style={{ width: "100%", flex: "none", height: `${CHART_BAR_HEIGHT_PX}px` }}>
                  <div
                    className={`progress-bar-fill ${isSelected ? "progress-peak" : isLast ? "progress-high" : progressLabelClassForRatio(ratio)}`}
                    style={{ "--progress-bar-height": `${height}%` } as CSSProperties}
                  />
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-session-context)" }}>{point.label}</div>
              </button>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────

export function HomeDashboard({ data }: { data: HomeData }) {
  return (
    <div>
      <EditorialDateHeader data={data} />
      <TodaySessionSection data={data} />
      <QuickStatsBento stats={data.quickStats} />
      <ProgramStatusSection data={data} />
      {data.lastSession && <LastSessionSection session={data.lastSession} />}
      <StrengthProgressSection items={data.strengthProgress} />
      <VolumeTrendSection points={data.volumeTrend} />
    </div>
  );
}
