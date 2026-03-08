import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

const primaryFlowCards = [
  {
    href: APP_ROUTES.todayLog,
    title: "오늘 기록 열기",
    subtitle: "핵심 화면",
    description: "선택한 플랜으로 세션을 만들고 세트 입력과 저장을 이어갑니다.",
    meta: "가장 자주 쓰는 시작점",
    symbol: "WO",
    tone: "accent" as const,
  },
  {
    href: APP_ROUTES.programStore,
    title: "프로그램/플랜 준비",
    subtitle: "준비 단계",
    description: "보유 플랜이 없으면 먼저 프로그램을 고르거나 직접 만든 뒤 오늘 운동으로 들어갑니다.",
    meta: "기록 전 준비",
    symbol: "PL",
    tone: "success" as const,
  },
];

const supportCards = [
  {
    href: APP_ROUTES.calendarHome,
    title: "날짜로 열기",
    subtitle: "캘린더",
    description: "오늘이 아닌 특정 날짜 기준으로 세션을 열거나 생성합니다.",
    meta: "캘린더 연동",
    symbol: "DT",
    tone: "default" as const,
  },
  {
    href: APP_ROUTES.todayOverrides,
    title: "세션 조정",
    subtitle: "고급 제어",
    description: "교체 운동과 보조 운동 규칙을 세밀하게 조정합니다.",
    meta: "오버라이드",
    symbol: "OV",
    tone: "warning" as const,
  },
  {
    href: APP_ROUTES.workoutRecord,
    title: "기록 워크스페이스",
    subtitle: "보조 기록 화면",
    description: "플랜 기반 기록을 다시 보거나 세부 편집이 필요할 때 사용합니다.",
    meta: "보조 입력 화면",
    symbol: "RC",
    tone: "neutral" as const,
  },
];

export default function WorkoutTodayIndexPage() {
  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="오늘 운동"
        title="오늘 세션 생성과 기록"
        description="실제 핵심 흐름은 플랜 준비 후 오늘 기록 화면에서 세션을 만들고 저장하는 것입니다. 이 화면은 그 동선과 보조 도구를 함께 정리합니다."
        primaryAction={{ href: APP_ROUTES.todayLog, label: "오늘 기록 열기", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.programStore, label: "플랜 준비", tone: "secondary" }}
        metrics={[
          { label: "핵심 흐름", value: "플랜 준비 -> 세션 생성 -> 저장" },
          { label: "날짜 기준", value: "오늘 / 특정 날짜" },
          { label: "보조 기능", value: "오버라이드 / 캘린더" },
        ]}
      />

      <DashboardActionSection
        title="핵심 동선"
        description="기록을 시작할 때 가장 필요한 두 단계만 먼저 고정했습니다."
        items={primaryFlowCards}
        gridClassName="app-dashboard-action-grid--two"
      />

      <DashboardActionSection
        title="보조 도구"
        description="날짜 기반 열기와 세션 조정은 메인 기록 흐름 아래로 분리했습니다."
        items={supportCards}
      />
    </DashboardScreen>
  );
}
