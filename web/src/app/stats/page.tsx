import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

const summaryCards = [
  {
    href: APP_ROUTES.statsDashboard,
    title: "전체 통계 대시보드",
    subtitle: "종합 보기",
    description: "볼륨, 준수율, PR, UX 지표를 한 화면에서 요약합니다.",
    meta: "기본 진입",
    symbol: "DB",
    tone: "accent" as const,
  },
  {
    href: APP_ROUTES.stats1rm,
    title: "1RM 추세",
    subtitle: "강도 변화",
    description: "운동별 e1RM 추이와 최고 기록을 차트로 확인합니다.",
    meta: "성능 지표",
    symbol: "RM",
    tone: "success" as const,
  },
  {
    href: APP_ROUTES.statsFilters,
    title: "필터 조정",
    subtitle: "분석 범위",
    description: "플랜, 기간, 운동 조건을 설정해 분석 범위를 좁힙니다.",
    meta: "입력 분리",
    symbol: "FL",
    tone: "default" as const,
  },
];

const detailCards = [
  {
    href: APP_ROUTES.todayLog,
    title: "오늘 기록으로 돌아가기",
    description: "새 기록을 저장해야 통계가 갱신됩니다. 오늘 세션 입력이 먼저라면 여기로 돌아갑니다.",
    meta: "데이터 추가",
    symbol: "TD",
    tone: "warning" as const,
  },
  {
    href: APP_ROUTES.plansManage,
    title: "플랜 기준으로 다시 보기",
    description: "특정 플랜 기준으로 기록 흐름을 복기하고 싶다면 플랜 화면에서 출발합니다.",
    meta: "범위 전환",
    symbol: "PL",
    tone: "neutral" as const,
  },
];

export default function StatsIndexPage() {
  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="통계"
        title="저장된 기록을 다시 보는 화면"
        description="통계는 오늘 기록을 저장한 뒤 변화와 성과를 확인하는 후속 화면입니다. 실제 데이터가 쌓일수록 여기서 보는 정보가 늘어납니다."
        primaryAction={{ href: APP_ROUTES.statsDashboard, label: "대시보드 열기", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.statsFilters, label: "필터 조정", tone: "secondary" }}
        metrics={[
          { label: "데이터 원본", value: "저장된 세션" },
          { label: "핵심 보기", value: "1RM / 볼륨 / 준수율" },
          { label: "조정", value: "필터" },
        ]}
      />

      <DashboardActionSection
        title="분석 시작"
        description="가장 많이 쓰는 분석 흐름을 먼저 노출했습니다."
        items={summaryCards}
      />

      <DashboardActionSection
        title="데이터 보강"
        description="통계가 비어 있거나 범위를 바꾸고 싶을 때 돌아갈 경로를 함께 배치했습니다."
        items={detailCards}
        gridClassName="app-dashboard-action-grid--two"
      />
    </DashboardScreen>
  );
}
