import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

const managementCards = [
  {
    href: APP_ROUTES.plansManage,
    title: "보유 플랜 관리",
    subtitle: "운영 중인 플랜",
    description: "이미 시작한 플랜의 이름, 최근 수행, 삭제와 히스토리를 관리합니다.",
    meta: "운영 화면",
    symbol: "PM",
    tone: "accent" as const,
  },
  {
    href: APP_ROUTES.plansHistory,
    title: "수행 히스토리",
    subtitle: "기록 복기",
    description: "플랜별 수행 로그와 진행 흐름을 되짚어 봅니다.",
    meta: "복기와 비교",
    symbol: "HS",
    tone: "neutral" as const,
  },
];

const setupCards = [
  {
    href: APP_ROUTES.programStore,
    title: "프로그램에서 새 플랜 시작",
    subtitle: "권장 시작",
    description: "새 플랜이 필요하면 프로그램을 고르고 바로 시작 흐름으로 연결합니다.",
    meta: "새 플랜 준비",
    symbol: "ST",
    tone: "success" as const,
  },
  {
    href: APP_ROUTES.programCreate,
    title: "커스텀 프로그램 만들기",
    subtitle: "직접 구성",
    description: "내 루틴을 직접 만든 뒤 플랜으로 이어갑니다.",
    meta: "커스텀 시작",
    symbol: "CP",
    tone: "warning" as const,
  },
  {
    href: APP_ROUTES.plansContext,
    title: "생성 기준 확인",
    subtitle: "고급 설정",
    description: "날짜, 시간대, 세션 키 규칙 같은 고급 생성 기준을 점검합니다.",
    meta: "생성 전 점검",
    symbol: "CX",
    tone: "default" as const,
  },
];

export default function PlansIndexPage() {
  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="플랜"
        title="보유 플랜 운영과 새 시작 준비"
        description="이 앱에서 플랜은 기록 전 준비 단계입니다. 이미 있는 플랜은 관리 화면에서 바로 오늘 운동으로 연결하고, 새로 시작할 때는 프로그램 선택 또는 직접 만들기로 들어갑니다."
        primaryAction={{ href: APP_ROUTES.plansManage, label: "보유 플랜 관리", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.programStore, label: "프로그램 고르기", tone: "secondary" }}
        metrics={[
          { label: "현재 역할", value: "기록 전 준비" },
          { label: "새 시작", value: "프로그램 선택 / 직접 만들기" },
          { label: "빠른 연결", value: "관리 화면에서 오늘 운동" },
        ]}
      />

      <DashboardActionSection
        title="보유 플랜 운영"
        description="이미 사용 중인 플랜을 확인하고 바로 이어서 관리할 수 있습니다."
        items={managementCards}
        gridClassName="app-dashboard-action-grid--two"
      />

      <DashboardActionSection
        title="새 플랜 준비"
        description="새로 시작할 때 필요한 진입점만 별도로 묶었습니다."
        items={setupCards}
      />
    </DashboardScreen>
  );
}
