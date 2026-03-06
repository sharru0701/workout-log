import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string, fallback: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  return raw ?? fallback;
}

function readPositiveInt(params: SearchParams, key: string, fallback: number) {
  const parsed = Number(readString(params, key, String(fallback)));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function toSelectionHref(pathname: string, returnTo: string) {
  const sp = new URLSearchParams();
  sp.set("returnTo", returnTo);
  return `${pathname}?${sp.toString()}`;
}

export default async function PlanContextPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const userId = readString(params, "userId", "dev");
  const startDate = readString(params, "startDate", new Date().toISOString().slice(0, 10));
  const timezone = readString(params, "timezone", "UTC");
  const sessionKeyMode = readString(params, "sessionKeyMode", "DATE");
  const week = readPositiveInt(params, "week", 1);
  const day = readPositiveInt(params, "day", 1);

  const returnQuery = new URLSearchParams();
  returnQuery.set("userId", userId);
  returnQuery.set("startDate", startDate);
  returnQuery.set("timezone", timezone);
  returnQuery.set("sessionKeyMode", sessionKeyMode);
  returnQuery.set("week", String(week));
  returnQuery.set("day", String(day));
  const returnTo = `${APP_ROUTES.plansContext}?${returnQuery.toString()}`;

  const contextCards = [
    {
      href: toSelectionHref("/plans/context/select/user-id", returnTo),
      title: "사용자 ID",
      description: "생성 대상 사용자 범위를 선택합니다.",
      meta: userId,
      symbol: "US",
      tone: "neutral" as const,
    },
    {
      href: toSelectionHref("/plans/context/picker/start-date", returnTo),
      title: "시작 날짜",
      description: "생성 기준 날짜를 설정합니다.",
      meta: startDate,
      symbol: "DT",
      tone: "accent" as const,
    },
    {
      href: toSelectionHref("/plans/context/select/timezone", returnTo),
      title: "시간대",
      description: "날짜 경계 계산 시간대를 설정합니다.",
      meta: timezone,
      symbol: "TZ",
      tone: "default" as const,
    },
    {
      href: toSelectionHref("/plans/context/select/session-key-mode", returnTo),
      title: "세션 키 방식",
      description: "세션 키 포맷을 선택합니다.",
      meta: sessionKeyMode,
      symbol: "SK",
      tone: "success" as const,
    },
    {
      href: toSelectionHref("/plans/context/picker/week", returnTo),
      title: "주차",
      description: "주차 인덱스를 설정합니다.",
      meta: String(week),
      symbol: "WK",
      tone: "default" as const,
    },
    {
      href: toSelectionHref("/plans/context/picker/day", returnTo),
      title: "일차",
      description: "일차 인덱스를 설정합니다.",
      meta: String(day),
      symbol: "DY",
      tone: "warning" as const,
    },
  ];

  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="플랜 기준"
        title="고급 생성 기준 확인"
        description="이 화면은 플랜 생성에 쓰이는 날짜, 시간대, 세션 키 기준을 점검하는 용도입니다. 실제 시작은 프로그램 선택 또는 커스텀 프로그램 만들기 흐름에서 진행합니다."
        primaryAction={{ href: APP_ROUTES.programStore, label: "프로그램 고르기", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.programCreate, label: "커스텀 프로그램 만들기", tone: "secondary" }}
        metrics={[
          { label: "시작일", value: startDate },
          { label: "시간대", value: timezone },
          { label: "세션 키", value: sessionKeyMode },
        ]}
      />

      <DashboardActionSection
        title="기준 항목"
        description="현재 값과 수정 진입점을 한 카드에 묶어 두었습니다."
        items={contextCards}
      />
    </DashboardScreen>
  );
}
