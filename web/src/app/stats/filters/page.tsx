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

function toSelectionHref(pathname: string, returnTo: string) {
  const sp = new URLSearchParams();
  sp.set("returnTo", returnTo);
  return `${pathname}?${sp.toString()}`;
}

function formatMetrics(raw: string) {
  const values = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length === 0) return "없음";
  if (values.length === 4) return "전체";
  return `${values.length}개 선택`;
}

export default async function StatsFiltersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const planScope = readString(params, "planScope", "all");
  const bucket = readString(params, "bucket", "week");
  const exercise = readString(params, "exercise", "Back Squat");
  const metrics = readString(params, "metrics", "e1rm,volume,compliance,prs");
  const days = readString(params, "days", "90");
  const from = readString(params, "from", "");
  const to = readString(params, "to", "");

  const returnQuery = new URLSearchParams();
  returnQuery.set("planScope", planScope);
  returnQuery.set("bucket", bucket);
  returnQuery.set("exercise", exercise);
  returnQuery.set("metrics", metrics);
  returnQuery.set("days", days);
  if (from) returnQuery.set("from", from);
  if (to) returnQuery.set("to", to);
  const returnTo = `${APP_ROUTES.statsFilters}?${returnQuery.toString()}`;

  const filterCards = [
    {
      href: toSelectionHref("/stats/filters/select/plan-scope", returnTo),
      title: "플랜 필터",
      description: "플랜 집계 범위를 선택합니다.",
      meta: planScope,
      symbol: "PL",
      tone: "neutral" as const,
    },
    {
      href: toSelectionHref("/stats/filters/select/bucket", returnTo),
      title: "집계 단위",
      description: "추세 집계 단위를 선택합니다.",
      meta: bucket,
      symbol: "RG",
      tone: "accent" as const,
    },
    {
      href: toSelectionHref("/stats/filters/select/exercise", returnTo),
      title: "운동 필터",
      description: "운동을 검색해 선택합니다.",
      meta: exercise,
      symbol: "EX",
      tone: "default" as const,
    },
    {
      href: toSelectionHref("/stats/filters/select/metrics", returnTo),
      title: "지표",
      description: "표시할 지표를 선택합니다.",
      meta: formatMetrics(metrics),
      symbol: "MT",
      tone: "success" as const,
    },
    {
      href: toSelectionHref("/stats/filters/picker/days", returnTo),
      title: "기본 일수",
      description: "기본 조회 일수를 설정합니다.",
      meta: days,
      symbol: "DY",
      tone: "warning" as const,
    },
    {
      href: toSelectionHref("/stats/filters/picker/from", returnTo),
      title: "시작일",
      description: "조회 시작일을 설정합니다.",
      meta: from || "미설정",
      symbol: "FR",
      tone: "default" as const,
    },
    {
      href: toSelectionHref("/stats/filters/picker/to", returnTo),
      title: "종료일",
      description: "조회 종료일을 설정합니다.",
      meta: to || "미설정",
      symbol: "TO",
      tone: "default" as const,
    },
    {
      href: `${APP_ROUTES.statsDashboard}?${returnQuery.toString()}`,
      title: "현재 조건으로 보기",
      description: "현재 필터로 바로 분석 화면을 엽니다.",
      meta: "바로 열기",
      symbol: "GO",
      tone: "accent" as const,
    },
  ];

  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="통계 필터"
        title="분석 범위를 먼저 정하기"
        description="저장된 기록을 어떤 플랜, 운동, 기간 기준으로 볼지 정하는 화면입니다. 조건을 정한 뒤 바로 대시보드로 넘어갈 수 있습니다."
        primaryAction={{ href: `${APP_ROUTES.statsDashboard}?${returnQuery.toString()}`, label: "대시보드 열기", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.statsHome, label: "통계 홈", tone: "secondary" }}
        metrics={[
          { label: "플랜", value: planScope },
          { label: "기간", value: from && to ? `${from} ~ ${to}` : `${days}일` },
          { label: "운동", value: exercise },
        ]}
      />

      <DashboardActionSection
        title="필터 항목"
        description="현재 값 확인과 수정 진입을 하나의 카드 체계로 통합했습니다."
        items={filterCards}
      />
    </DashboardScreen>
  );
}
