import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

const overrideCards = [
  {
    href: APP_ROUTES.todayLog,
    title: "보조 운동 고정",
    subtitle: "보조 운동",
    description: "보조 운동 선택을 기본값으로 저장합니다.",
    meta: "오늘 기록 화면에서 적용",
    symbol: "AP",
    tone: "warning" as const,
  },
  {
    href: APP_ROUTES.todayLog,
    title: "운동 교체",
    subtitle: "교체 규칙",
    description: "세션 대상 운동을 다른 운동으로 바꿉니다.",
    meta: "오늘 기록 화면에서 적용",
    symbol: "RE",
    tone: "accent" as const,
  },
];

export default function WorkoutOverridesPage() {
  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="세션 조정"
        title="세션 오버라이드"
        description="오버라이드는 독립된 시작 화면이 아니라 오늘 기록 중 필요할 때 쓰는 보조 기능입니다. 실제 적용은 오늘 기록 화면에서 이어집니다."
        primaryAction={{ href: APP_ROUTES.todayLog, label: "오늘 기록으로 돌아가기", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.calendarManage, label: "날짜 기준 세션", tone: "secondary" }}
        metrics={[
          { label: "대상", value: "교체 / 보조 운동" },
          { label: "사용 시점", value: "기록 중간" },
          { label: "실행 위치", value: "오늘 기록 화면" },
        ]}
      />

      <DashboardActionSection
        title="오버라이드 동작"
        description="실제 변경 작업은 오늘 기록 화면으로 이어지도록 카드에 명시했습니다."
        items={overrideCards}
        gridClassName="app-dashboard-action-grid--two"
      />
    </DashboardScreen>
  );
}
