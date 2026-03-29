"use client";

import { memo } from "react";
import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";
import type {
  HomeData,
  HomeLastSession,
  HomeQuickStats,
  HomePlanOverview,
  HomeTodaySummary,
  HomeWeeklySummary,
} from "@/lib/home/home-data-source";

// ─── Helpers ──────────────────────────────────────────────────────────

function formatVolumeTons(kg: number): string {
  const tons = kg / 1000;
  return tons % 1 === 0 ? `${tons}` : `${tons.toFixed(1)}`;
}

function formatDurationMin(sets: number): number {
  // Estimate duration: ~2 min per set as a rough proxy
  return Math.max(20, Math.round(sets * 2));
}

function todayDateString(): string {
  const now = new Date();
  return now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function computeProgramProgress(planOverview: HomePlanOverview): number | null {
  // We don't have direct session/total data on the overview; return null to hide when unavailable
  return null;
}

// ─── Section 1: Welcome Header ────────────────────────────────────────

const WelcomeSection = memo(function WelcomeSection({ today }: { today: HomeTodaySummary }) {
  const hasPlan = !!today.programName && today.programName !== "플랜 준비 필요";
  const statusLabel = hasPlan ? "Status: Active" : "Status: No Plan";

  return (
    <section className="hd-welcome">
      <p className="hd-welcome__status">{statusLabel}</p>
      <h1 className="hd-welcome__title">{todayDateString()}</h1>
    </section>
  );
});

// ─── Section 2: Streak / Momentum Banner ─────────────────────────────

const MomentumBanner = memo(function MomentumBanner({
  quickStats,
  today,
}: {
  quickStats: HomeQuickStats;
  today: HomeTodaySummary;
}) {
  const streak = quickStats.currentStreak;
  const hasStreak = streak > 0;

  const mainExercises = today.plannedExercises.filter((e) => e.role === "MAIN");
  const nextTarget = mainExercises.length > 0 ? mainExercises[0].name : today.programName;

  return (
    <section className="hd-banner">
      <div className="hd-banner__content">
        <p className="hd-banner__eyebrow">Current Momentum</p>
        <h3 className="hd-banner__title">
          {hasStreak ? `${streak}일 연속 진행 중.` : "운동을 시작하세요."}
        </h3>
        {nextTarget && (
          <p className="hd-banner__subtitle">
            다음 목표:{" "}
            <span className="hd-banner__subtitle-highlight">{nextTarget}</span>
          </p>
        )}
      </div>
      <div className="hd-banner__icon-wrap">
        <span
          className="material-symbols-outlined hd-banner__icon"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
        >
          local_fire_department
        </span>
      </div>
      <div className="hd-banner__glow" aria-hidden="true" />
    </section>
  );
});

// ─── Section 3: Today's Protocol Card ────────────────────────────────

const TodayProtocolCard = memo(function TodayProtocolCard({
  today,
  planOverview,
  weeklySummary,
}: {
  today: HomeTodaySummary;
  planOverview: HomePlanOverview;
  weeklySummary: HomeWeeklySummary;
}) {
  const hasPlan = planOverview.totalPlans > 0;
  const programName = planOverview.highlightedProgramName ?? planOverview.highlightedPlanName ?? null;
  const planName = planOverview.highlightedPlanName ?? today.programName;
  const hasTodayActivity = today.completedSets > 0;

  const completedDays = weeklySummary.days.filter((d) => d.hasWorkout).length;
  const totalDays = weeklySummary.days.length;
  const weekProgressPct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  const ctaLabel = hasTodayActivity ? "이어서 하기" : hasPlan ? "운동 시작" : "프로그램 선택";
  const ctaHref = today.href;

  if (!hasPlan) {
    return (
      <section className="hd-section">
        <div className="hd-section__header">
          <h3 className="hd-section__title">오늘의 프로토콜</h3>
        </div>
        <div className="hd-protocol hd-protocol--empty">
          <div className="hd-protocol__inner">
            <span className="hd-protocol__eyebrow">No Active Program</span>
            <h4 className="hd-protocol__name">프로그램을 선택하세요</h4>
            <p className="hd-protocol__empty-desc">
              프로그램 스토어에서 루틴을 선택하면 오늘 운동이 자동으로 구성됩니다.
            </p>
            <Link href={APP_ROUTES.programStore} className="hd-cta-btn">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                library_books
              </span>
              <span>프로그램 둘러보기</span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="hd-section">
      <div className="hd-section__header">
        <h3 className="hd-section__title">오늘의 프로토콜</h3>
        {planOverview.lastPerformedAtLabel && (
          <span className="hd-section__meta">마지막 {planOverview.lastPerformedAtLabel}</span>
        )}
      </div>

      <div className="hd-protocol">
        <div className="hd-protocol__gradient" aria-hidden="true" />
        <div className="hd-protocol__inner">
          {programName && (
            <span className="hd-protocol__eyebrow">{programName}</span>
          )}
          <h4 className="hd-protocol__name">{planName}</h4>

          {/* Weekly progress bar */}
          <div className="hd-protocol__progress">
            <div className="hd-protocol__progress-labels">
              <span className="hd-protocol__progress-label">이번 주 활동</span>
              <span className="hd-protocol__progress-pct">{weekProgressPct}%</span>
            </div>
            <div className="hd-protocol__progress-track" role="progressbar" aria-valuenow={weekProgressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="hd-protocol__progress-fill" style={{ width: `${weekProgressPct}%` }} />
            </div>
          </div>

          {/* Weekly activity dots */}
          <div
            className="hd-protocol__week-dots"
            aria-label="최근 7일 운동 활동"
          >
            {weeklySummary.days.map((day) => (
              <div
                key={day.key}
                className="hd-protocol__week-day"
                aria-label={`${day.dateLabel} ${day.shortLabel} ${day.hasWorkout ? "운동함" : "휴식"}`}
              >
                <span className="hd-protocol__day-label">{day.shortLabel}</span>
                <span
                  className={`hd-protocol__dot ${day.hasWorkout ? "hd-protocol__dot--active" : ""} ${day.isToday ? "hd-protocol__dot--today" : ""}`}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>

          <Link href={ctaHref} className="hd-cta-btn">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              play_arrow
            </span>
            <span>{ctaLabel}</span>
          </Link>
        </div>
      </div>
    </section>
  );
});

// ─── Section 4: Last Entry Bento ─────────────────────────────────────

const LastEntryBento = memo(function LastEntryBento({ session }: { session: HomeLastSession }) {
  const totalVolumeTons = formatVolumeTons(session.totalVolume);
  const durationMin = formatDurationMin(session.totalSets);

  // Count PRs: exercises where weightDelta is null or negative (they matched or beat target)
  const prCount = session.exercises.filter(
    (ex) => ex.weightDelta !== null && ex.weightDelta <= 0
  ).length;

  return (
    <section className="hd-section">
      <div className="hd-section__header">
        <h3 className="hd-section__title">지난 세션</h3>
        <span className="hd-section__meta">{session.date}</span>
      </div>

      <Link href={session.href} className="hd-bento-grid" aria-label={`지난 세션: ${session.planName}`}>
        {/* Full-width workload tile */}
        <div className="hd-bento-tile hd-bento-tile--wide">
          <div>
            <p className="hd-bento-tile__label">Total Workload</p>
            <div className="hd-bento-tile__value-row">
              <span className="hd-bento-tile__number">{totalVolumeTons}</span>
              <span className="hd-bento-tile__unit">tons</span>
            </div>
            <p className="hd-bento-tile__sub">{session.planName}</p>
          </div>
          <span className="material-symbols-outlined hd-bento-tile__icon hd-bento-tile__icon--secondary">
            fitness_center
          </span>
        </div>

        {/* Duration tile */}
        <div className="hd-bento-tile">
          <p className="hd-bento-tile__label">Duration</p>
          <div className="hd-bento-tile__value-row">
            <span className="hd-bento-tile__number">{durationMin}</span>
            <span className="hd-bento-tile__unit">Min</span>
          </div>
          <p className="hd-bento-tile__sub">{session.totalSets} sets</p>
        </div>

        {/* PRs tile */}
        <div className="hd-bento-tile hd-bento-tile--pr">
          <p className="hd-bento-tile__label">목표 달성</p>
          <div className="hd-bento-tile__value-row hd-bento-tile__value-row--tertiary">
            <span className="hd-bento-tile__number">{prCount}</span>
            <span
              className="material-symbols-outlined hd-bento-tile__star"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              stars
            </span>
          </div>
          <p className="hd-bento-tile__sub">{session.exercises.length} exercises</p>
        </div>
      </Link>
    </section>
  );
});

// ─── Section 5: Logistics Quick Links ────────────────────────────────

const LogisticsSection = memo(function LogisticsSection() {
  const links = [
    {
      href: APP_ROUTES.programStore,
      icon: "library_books",
      title: "Program Store",
      subtitle: "Browse Protocols",
    },
    {
      href: APP_ROUTES.templatesHome,
      icon: "content_copy",
      title: "Templates",
      subtitle: "Custom Routines",
    },
    {
      href: APP_ROUTES.plansHome,
      icon: "calendar_month",
      title: "My Plans",
      subtitle: "Manage & Schedule",
    },
    {
      href: APP_ROUTES.statsHome,
      icon: "show_chart",
      title: "Stats",
      subtitle: "Progress Tracking",
    },
  ];

  return (
    <section className="hd-section">
      <div className="hd-section__header">
        <h3 className="hd-section__title">Logistics</h3>
      </div>
      <div className="hd-logistics">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hd-logistics-row">
            <div className="hd-logistics-row__left">
              <div className="hd-logistics-row__icon-wrap">
                <span className="material-symbols-outlined hd-logistics-row__icon">
                  {link.icon}
                </span>
              </div>
              <div>
                <p className="hd-logistics-row__title">{link.title}</p>
                <p className="hd-logistics-row__subtitle">{link.subtitle}</p>
              </div>
            </div>
            <span className="material-symbols-outlined hd-logistics-row__arrow">
              arrow_forward_ios
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
});

// ─── Main Dashboard ───────────────────────────────────────────────────

export function HomeDashboard({ data }: { data: HomeData }) {
  return (
    <div className="hd-root">
      <WelcomeSection today={data.today} />
      <MomentumBanner quickStats={data.quickStats} today={data.today} />
      <TodayProtocolCard
        today={data.today}
        planOverview={data.planOverview}
        weeklySummary={data.weeklySummary}
      />
      {data.lastSession && <LastEntryBento session={data.lastSession} />}
      <LogisticsSection />
    </div>
  );
}
