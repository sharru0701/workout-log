"use client";

import type { JSX, SVGProps } from "react";
import Link from "next/link";
import { DashboardHero } from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";
import type { HomeData } from "@/lib/home/home-data-source";

type ActionIconProps = SVGProps<SVGSVGElement>;

type HeroAction = {
  href: string;
  label: string;
};

type HeroTone = "ready" | "active" | "setup";

type HeroContent = {
  badge: string;
  title: string;
  description: string;
  primaryAction: HeroAction;
  secondaryAction: HeroAction;
  tone: HeroTone;
};

function toDashboardHeroTone(tone: HeroTone) {
  if (tone === "active") return "accent" as const;
  if (tone === "setup") return "quiet" as const;
  return "default" as const;
}

type QuickAction = {
  href: string;
  label: string;
  description: string;
  Icon: (props: ActionIconProps) => JSX.Element;
};

function BoltIcon(props: ActionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m13.5 2.75-7 10h4.75l-1 8.5 7-10H13l.5-8.5Z" />
    </svg>
  );
}

function CalendarIcon(props: ActionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7.5 3.75v3" />
      <path d="M16.5 3.75v3" />
      <path d="M4.5 9h15" />
      <rect x="4.5" y="5.25" width="15" height="14.25" rx="2.25" />
      <path d="M8.5 12.5h3" />
      <path d="M8.5 16h7" />
    </svg>
  );
}

function TrendIcon(props: ActionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5.25 18.75h13.5" />
      <path d="m7.25 14.75 3.5-3.5 2.75 2.75 4.25-5.25" />
      <path d="M17.75 8.75h.01" />
    </svg>
  );
}

function PlanIcon(props: ActionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.25" />
      <path d="M8 9h8" />
      <path d="M8 13h4.5" />
      <path d="m14.75 14.15 1 1 2.1-2.35" />
    </svg>
  );
}

function StoreIcon(props: ActionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5.25 9.75h13.5" />
      <path d="M6.5 9.75v8.25h11V9.75" />
      <path d="m6 9.75 1.35-4.5h9.3L18 9.75" />
      <path d="M9.25 13.25h5.5" />
    </svg>
  );
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function buildHeroContent(data: HomeData): HeroContent {
  const hasPlans = data.planOverview.totalPlans > 0;
  const hasTodayActivity = data.today.completedSets > 0;

  if (hasTodayActivity) {
    return {
      badge: "오늘 세션 진행 중",
      title: "오늘 기록 화면으로 돌아가기",
      description: `${data.today.programName} 기준으로 오늘 ${data.today.completedSets}세트를 기록했습니다. 같은 세션에서 계속 입력하고 저장 상태를 확인할 수 있습니다.`,
      primaryAction: {
        href: data.today.href,
        label: "오늘 운동 이어서 하기",
      },
      secondaryAction: {
        href: APP_ROUTES.plansManage,
        label: "보유 플랜 보기",
      },
      tone: "active",
    };
  }

  if (hasPlans) {
    const highlightedPlan = data.planOverview.highlightedPlanName ?? data.today.programName;
    return {
      badge: "빠른 시작 가능",
      title: "플랜에서 오늘 세션을 생성하세요",
      description: `${highlightedPlan} 플랜이 준비되어 있습니다. 오늘 운동은 플랜 기반으로 생성되므로 오늘 기록 화면에서 세션을 만들고 바로 입력을 시작합니다.`,
      primaryAction: {
        href: data.today.href,
        label: "오늘 운동 시작",
      },
      secondaryAction: {
        href: APP_ROUTES.programStore,
        label: "다른 프로그램 보기",
      },
      tone: "ready",
    };
  }

  return {
    badge: "플랜 준비 필요",
    title: "먼저 프로그램을 선택하세요",
    description: "이 앱은 플랜을 먼저 준비한 뒤 기록을 시작합니다. 프로그램 스토어에서 고르거나 커스텀 프로그램을 만든 다음 오늘 운동으로 넘어가는 흐름이 기본입니다.",
    primaryAction: {
      href: APP_ROUTES.programStore,
      label: "프로그램 선택 후 시작",
    },
    secondaryAction: {
      href: APP_ROUTES.programCreate,
      label: "커스텀 프로그램 만들기",
    },
    tone: "setup",
  };
}

function buildStartActions(data: HomeData): QuickAction[] {
  const hasPlans = data.planOverview.totalPlans > 0;
  const hasTodayActivity = data.today.completedSets > 0;

  return [
    {
      href: hasPlans ? data.today.href : APP_ROUTES.programStore,
      label: hasPlans ? (hasTodayActivity ? "오늘 운동 이어서 하기" : "오늘 운동 시작") : "프로그램 선택 후 시작",
      description: hasPlans
        ? hasTodayActivity
          ? "오늘 기록 화면으로 돌아가 입력과 저장을 계속합니다."
          : "준비된 플랜으로 오늘 세션을 생성하고 기록을 시작합니다."
        : "보유 플랜이 없으면 먼저 프로그램 스토어에서 프로그램을 선택해야 합니다.",
      Icon: BoltIcon,
    },
    {
      href: APP_ROUTES.programStore,
      label: "프로그램 선택",
      description: "시중 프로그램을 둘러보고 시작할 프로그램을 정합니다.",
      Icon: StoreIcon,
    },
    {
      href: APP_ROUTES.programCreate,
      label: "커스텀 프로그램 만들기",
      description: "내 루틴 구성을 직접 만들고 시작 프로그램으로 연결합니다.",
      Icon: PlanIcon,
    },
  ];
}

function buildToolActions(data: HomeData): QuickAction[] {
  return [
    {
      href: APP_ROUTES.plansManage,
      label: "보유 플랜 관리",
      description: data.planOverview.totalPlans > 0 ? "기존 플랜 이름, 히스토리, 정리를 진행합니다." : "준비된 플랜이 생기면 여기서 관리합니다.",
      Icon: PlanIcon,
    },
    {
      href: APP_ROUTES.calendarManage,
      label: "날짜 기준 세션",
      description: "특정 날짜로 세션을 생성하거나 캘린더에서 확인합니다.",
      Icon: CalendarIcon,
    },
    {
      href: APP_ROUTES.stats1rm,
      label: "1RM 추세",
      description: "저장된 운동 기록의 최고 기록과 추정치를 확인합니다.",
      Icon: TrendIcon,
    },
    {
      href: APP_ROUTES.templatesManage,
      label: "템플릿 편집",
      description: "템플릿 포크와 버전 편집 작업을 진행합니다.",
      Icon: StoreIcon,
    },
  ];
}

function planOverviewTitle(data: HomeData) {
  if (data.planOverview.totalPlans === 0) {
    return "보유 플랜이 없습니다";
  }
  return data.planOverview.highlightedPlanName ?? "최근 사용 플랜";
}

function planOverviewDescription(data: HomeData) {
  if (data.planOverview.totalPlans === 0) {
    return "프로그램 스토어에서 프로그램을 시작하면 플랜이 생성되고 오늘 운동 흐름과 연결됩니다.";
  }

  const details = [
    data.planOverview.highlightedProgramName ? `기반 프로그램 ${data.planOverview.highlightedProgramName}` : null,
    data.planOverview.lastPerformedAtLabel ? `마지막 수행 ${data.planOverview.lastPerformedAtLabel}` : "아직 수행 기록 없음",
  ].filter(Boolean);
  return details.join(" · ");
}

function planOverviewMeta(data: HomeData) {
  if (data.planOverview.totalPlans === 0) {
    return "스토어 또는 직접 생성";
  }
  return `보유 플랜 ${data.planOverview.totalPlans}개`;
}

function weeklySummaryTitle(data: HomeData) {
  return `최근 7일 ${data.weeklySummary.activeDays}일 운동`;
}

function weeklySummaryDescription(data: HomeData) {
  if (data.weeklySummary.sessionCount === 0) {
    return "첫 세션을 저장하면 최근 7일 리듬이 여기에 표시됩니다.";
  }
  return `${data.weeklySummary.sessionCount}회 운동 · ${data.weeklySummary.completedSets}세트 · 휴식 ${data.weeklySummary.restDays}일`;
}

export function HomeDashboard({ data }: { data: HomeData }) {
  const hero = buildHeroContent(data);
  const startActions = buildStartActions(data);
  const toolActions = buildToolActions(data);
  const metrics = [
    {
      label: "보유 플랜",
      value: `${data.planOverview.totalPlans}개`,
    },
    {
      label: "오늘 상태",
      value: data.today.completedSets > 0 ? `${data.today.completedSets}세트 기록` : data.planOverview.totalPlans > 0 ? "시작 전" : "플랜 없음",
    },
    {
      label: "최근 7일",
      value: `${data.weeklySummary.activeDays}/${data.weeklySummary.days.length}일`,
    },
  ];
  const showRecentEmpty = data.recentSessions.length === 0;
  const planHref = data.planOverview.totalPlans > 0 ? APP_ROUTES.plansManage : APP_ROUTES.programStore;
  const planActionLabel = data.planOverview.totalPlans > 0 ? "플랜 보기" : "플랜 준비";

  return (
    <>
      <DashboardHero
        eyebrow="오늘 대시보드"
        title={hero.title}
        description={hero.description}
        topSlot={
          <>
            <p className="home-dashboard-date">{formatTodayLabel()}</p>
            <span className={`home-dashboard-badge home-dashboard-badge--${hero.tone}`}>{hero.badge}</span>
          </>
        }
        primaryAction={{
          href: hero.primaryAction.href,
          label: (
            <>
              <BoltIcon className="home-dashboard-cta-icon" aria-hidden="true" />
              <span>{hero.primaryAction.label}</span>
            </>
          ),
          tone: "primary",
        }}
        secondaryAction={{
          href: hero.secondaryAction.href,
          label: hero.secondaryAction.label,
          tone: "secondary",
        }}
        metrics={metrics}
        tone={toDashboardHeroTone(hero.tone)}
      />

      <section className="home-dashboard-section">
        <div className="home-dashboard-section-head">
          <h2 className="home-dashboard-section-title">빠른 시작</h2>
          <p className="home-dashboard-section-copy">실제 앱 흐름에 맞춰 프로그램 준비, 오늘 운동 시작, 커스텀 프로그램 만들기를 가장 먼저 배치했습니다.</p>
        </div>

        <div className="home-dashboard-quick-grid">
          {startActions.map((action) => {
            const Icon = action.Icon;
            return (
              <Link key={action.label} className="home-dashboard-quick-card" href={action.href}>
                <span className="home-dashboard-quick-icon" aria-hidden="true">
                  <Icon className="home-dashboard-quick-icon-svg" />
                </span>
                <span className="home-dashboard-quick-label">{action.label}</span>
                <span className="home-dashboard-quick-copy">{action.description}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-dashboard-section">
        <div className="home-dashboard-section-head">
          <h2 className="home-dashboard-section-title">현재 준비 상태</h2>
          <p className="home-dashboard-section-copy">오늘 시작에 필요한 준비 정도와 최근 7일 운동 리듬을 한눈에 볼 수 있게 유지했습니다.</p>
        </div>

        <div className="home-dashboard-glance-grid">
          <Link className="home-dashboard-glance-card" href={planHref}>
            <div className="home-dashboard-glance-kicker">플랜 준비</div>
            <div className="home-dashboard-glance-title">{planOverviewTitle(data)}</div>
            <p className="home-dashboard-glance-copy">{planOverviewDescription(data)}</p>
            <div className="home-dashboard-glance-footer">
              <span>{planOverviewMeta(data)}</span>
              <span>{planActionLabel}</span>
            </div>
          </Link>

          <div className="home-dashboard-glance-card home-dashboard-glance-card--static">
            <div className="home-dashboard-glance-kicker">최근 7일</div>
            <div className="home-dashboard-glance-title">{weeklySummaryTitle(data)}</div>
            <p className="home-dashboard-glance-copy">{weeklySummaryDescription(data)}</p>
            <div className="home-dashboard-week-strip" aria-label="최근 7일 운동 활동">
              {data.weeklySummary.days.map((day) => (
                <div
                  key={day.key}
                  className={`home-dashboard-day${day.hasWorkout ? " is-active" : ""}${day.isToday ? " is-today" : ""}`}
                  aria-label={`${day.dateLabel} ${day.shortLabel} ${day.hasWorkout ? "운동함" : "휴식"}`}
                >
                  <span className="home-dashboard-day-label">{day.shortLabel}</span>
                  <span className="home-dashboard-day-dot" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-dashboard-section">
        <div className="home-dashboard-section-head">
          <h2 className="home-dashboard-section-title">보조 화면</h2>
          <p className="home-dashboard-section-copy">캘린더, 플랜 관리, 통계, 템플릿은 시작 흐름 아래 보조 도구로 분리했습니다.</p>
        </div>

        <div className="home-dashboard-quick-grid">
          {toolActions.map((action) => {
            const Icon = action.Icon;
            return (
              <Link key={action.label} className="home-dashboard-quick-card" href={action.href}>
                <span className="home-dashboard-quick-icon" aria-hidden="true">
                  <Icon className="home-dashboard-quick-icon-svg" />
                </span>
                <span className="home-dashboard-quick-label">{action.label}</span>
                <span className="home-dashboard-quick-copy">{action.description}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-dashboard-section">
        <div className="home-dashboard-section-head">
          <h2 className="home-dashboard-section-title">최근 운동</h2>
          <p className="home-dashboard-section-copy">최근 완료한 세션을 홈에서 바로 다시 열 수 있게 유지했습니다.</p>
        </div>

        {showRecentEmpty ? (
          <div className="home-dashboard-empty-card">
            <div className="home-dashboard-empty-title">최근 기록이 없습니다</div>
            <p className="home-dashboard-empty-copy">플랜을 준비한 뒤 오늘 기록 화면에서 첫 세션을 저장하면 최근 기록이 이 영역에 쌓입니다.</p>
            <Link className="home-dashboard-inline-link" href={data.today.href}>
              {data.planOverview.totalPlans > 0 ? "오늘 운동 열기" : "프로그램 선택하기"}
            </Link>
          </div>
        ) : (
          <div className="home-dashboard-recent-list">
            {data.recentSessions.map((session, index) => (
              <Link key={session.id} className="home-dashboard-recent-card" href={session.href}>
                <div className="home-dashboard-recent-rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="home-dashboard-recent-body">
                  <div className="home-dashboard-recent-meta">{session.subtitle}</div>
                  <div className="home-dashboard-recent-title">{session.title}</div>
                  <div className="home-dashboard-recent-copy">{session.description}</div>
                </div>
                <div className="home-dashboard-recent-action">열기</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
