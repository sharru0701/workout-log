import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

const calendarCards = [
  {
    href: APP_ROUTES.calendarManage,
    title: "캘린더 열기",
    subtitle: "기본 화면",
    description: "월/주 보기와 날짜별 생성 상태를 한 화면에서 확인합니다.",
    meta: "기본 진입",
    symbol: "CW",
    tone: "accent" as const,
  },
  {
    href: APP_ROUTES.calendarOptions,
    title: "열기 규칙 설정",
    subtitle: "옵션",
    description: "보기 방식과 열기 동작을 설정해 캘린더 흐름을 맞춥니다.",
    meta: "환경 설정",
    symbol: "OP",
    tone: "default" as const,
  },
];

const integrationCards = [
  {
    href: APP_ROUTES.todayLog,
    title: "오늘 기록으로 이동",
    subtitle: "기록 화면",
    description: "오늘 날짜 세션을 바로 열어 기록합니다.",
    meta: "핵심 기록 화면",
    symbol: "TD",
    tone: "success" as const,
  },
  {
    href: APP_ROUTES.plansManage,
    title: "플랜 확인",
    subtitle: "사전 준비",
    description: "캘린더에서 사용할 플랜과 최근 수행 이력을 확인합니다.",
    meta: "사전 준비",
    symbol: "PL",
    tone: "neutral" as const,
  },
];

export default function CalendarIndexPage() {
  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="캘린더"
        title="날짜 기준으로 세션 열기"
        description="캘린더는 플랜을 날짜와 연결하는 보조 화면입니다. 특정 날짜에서 세션을 열거나 자동 생성할 때 사용합니다."
        primaryAction={{ href: APP_ROUTES.calendarManage, label: "캘린더 열기", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.calendarOptions, label: "열기 규칙 설정", tone: "secondary" }}
        metrics={[
          { label: "기본 역할", value: "날짜별 세션 열기" },
          { label: "입력", value: "플랜 + 날짜" },
          { label: "연결", value: "오늘 기록 / 플랜" },
        ]}
      />

      <DashboardActionSection
        title="캘린더 작업"
        description="날짜 중심 작업은 한 묶음으로 정리했습니다."
        items={calendarCards}
        gridClassName="app-dashboard-action-grid--two"
      />

      <DashboardActionSection
        title="연결 흐름"
        description="캘린더는 오늘 기록과 플랜 확인을 잇는 역할에 맞춰 배치했습니다."
        items={integrationCards}
        gridClassName="app-dashboard-action-grid--two"
      />
    </DashboardScreen>
  );
}
