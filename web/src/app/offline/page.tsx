import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

const recoveryCards = [
  {
    href: APP_ROUTES.todayLog,
    title: "오늘 기록 계속하기",
    subtitle: "핵심 복구",
    description: "오프라인에서도 기록을 계속 남기고 로컬 대기열에 저장합니다.",
    meta: "핵심 복구 흐름",
    symbol: "LG",
    tone: "accent" as const,
  },
  {
    href: "/settings/data",
    title: "로컬 데이터 내보내기",
    subtitle: "백업",
    description: "재연결 전에 백업 파일을 만들어 유실 위험을 줄입니다.",
    meta: "안전 장치",
    symbol: "BK",
    tone: "warning" as const,
  },
];

const statusCards = [
  {
    href: "/settings/offline-help",
    title: "오프라인 도움말",
    subtitle: "안내",
    description: "대기열, 재전송, 복구 흐름을 상세히 확인합니다.",
    meta: "추가 안내",
    symbol: "HD",
    tone: "neutral" as const,
  },
];

export default function OfflinePage() {
  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="오프라인"
        title="오프라인 복구 흐름"
        description="연결이 끊겨도 핵심 흐름은 오늘 기록을 계속하는 것입니다. 저장은 로컬 대기열에 쌓이고 재연결되면 다시 전송됩니다."
        primaryAction={{ href: APP_ROUTES.todayLog, label: "기록 계속하기", tone: "primary" }}
        secondaryAction={{ href: "/settings/data", label: "백업 열기", tone: "secondary" }}
        metrics={[
          { label: "기록 방식", value: "로컬 대기열 저장" },
          { label: "동기화", value: "재연결 시 자동 전송" },
          { label: "지원 범위", value: "핵심 화면 사용 가능" },
        ]}
      />

      <DashboardActionSection
        title="복구 행동"
        description="연결이 불안정할 때 가장 필요한 행동만 위쪽에 배치했습니다."
        items={recoveryCards}
        gridClassName="app-dashboard-action-grid--two"
      />

      <DashboardActionSection
        title="상태 안내"
        description="자동 동기화와 세부 도움말은 보조 섹션으로 정리했습니다."
        items={statusCards}
        gridClassName="app-dashboard-action-grid--two"
      />
    </DashboardScreen>
  );
}
