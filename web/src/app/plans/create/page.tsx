import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

const creationCards = [
  {
    href: APP_ROUTES.programStore,
    title: "프로그램 고르고 시작",
    subtitle: "권장 경로",
    description: "프로그램 스토어에서 프로그램을 선택하면 플랜이 생성되고 바로 시작 흐름으로 이어집니다.",
    meta: "가장 자연스러운 시작",
    symbol: "ST",
    tone: "success" as const,
  },
  {
    href: APP_ROUTES.programCreate,
    title: "커스텀 프로그램 만들기",
    subtitle: "직접 구성",
    description: "내 루틴을 직접 만들고 플랜으로 바로 연결합니다.",
    meta: "직접 설계",
    symbol: "CR",
    tone: "accent" as const,
  },
  {
    href: APP_ROUTES.plansContext,
    title: "생성 기준 점검",
    subtitle: "고급 설정",
    description: "날짜, 시간대, 세션 키 기준을 먼저 확인해야 할 때 사용합니다.",
    meta: "고급 사용자용",
    symbol: "CX",
    tone: "warning" as const,
  },
  {
    href: APP_ROUTES.plansManage,
    title: "기존 플랜 관리",
    subtitle: "운영 화면",
    description: "이미 있는 플랜은 생성이 아니라 관리 화면에서 다룹니다.",
    meta: "보유 플랜 정리",
    symbol: "PM",
    tone: "neutral" as const,
  },
];

export default function PlanCreatePage() {
  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="플랜 생성 안내"
        title="새 플랜은 프로그램 화면에서 시작합니다"
        description="이 페이지는 생성 방식 안내용입니다. 실제 시작은 프로그램 스토어에서 고르거나 커스텀 프로그램을 만드는 흐름으로 진행됩니다."
        primaryAction={{ href: APP_ROUTES.programStore, label: "프로그램 고르기", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.programCreate, label: "커스텀 프로그램 만들기", tone: "secondary" }}
        metrics={[
          { label: "권장 시작", value: "프로그램 선택" },
          { label: "직접 만들기", value: "커스텀 프로그램" },
          { label: "고급 점검", value: "생성 기준 확인" },
        ]}
      />

      <DashboardActionSection
        title="시작 경로"
        description="앱에서 실제로 쓰이는 새 플랜 시작 경로만 남겼습니다."
        items={creationCards}
      />
    </DashboardScreen>
  );
}
