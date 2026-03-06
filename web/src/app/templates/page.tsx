import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

const libraryCards = [
  {
    href: APP_ROUTES.templatesManage,
    title: "템플릿 둘러보기",
    subtitle: "라이브러리",
    description: "공개 템플릿과 개인 템플릿을 한곳에서 확인합니다.",
    meta: "기본 진입",
    symbol: "TW",
    tone: "accent" as const,
  },
  {
    href: APP_ROUTES.templatesManage,
    title: "포크 후 수정",
    subtitle: "편집 시작",
    description: "공개 템플릿을 복사해 내 작업공간에서 수정합니다.",
    meta: "편집 전 복제",
    symbol: "FK",
    tone: "success" as const,
  },
];

const integrationCards = [
  {
    href: APP_ROUTES.programStore,
    title: "프로그램 스토어로 연결",
    subtitle: "연결 흐름",
    description: "템플릿 기반 프로그램을 고르고 플랜 시작 흐름으로 이어갑니다.",
    meta: "프로그램 시작 전 단계",
    symbol: "ST",
    tone: "default" as const,
  },
  {
    href: APP_ROUTES.programCreate,
    title: "커스텀 프로그램 만들기",
    subtitle: "직접 구성",
    description: "템플릿 대신 내 루틴을 직접 정의하고 싶을 때 같은 시작 흐름으로 이동합니다.",
    meta: "직접 만들기",
    symbol: "CP",
    tone: "neutral" as const,
  },
];

export default function TemplatesIndexPage() {
  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="템플릿"
        title="프로그램의 원본을 다루는 화면"
        description="템플릿은 직접 기록 화면으로 가지 않고, 프로그램 생성과 커스터마이징의 재료 역할을 합니다."
        primaryAction={{ href: APP_ROUTES.templatesManage, label: "템플릿 관리", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.programStore, label: "프로그램 스토어", tone: "secondary" }}
        metrics={[
          { label: "역할", value: "프로그램 원본" },
          { label: "주요 작업", value: "탐색 / 포크 / 편집" },
          { label: "연결", value: "스토어 / 커스텀" },
        ]}
      />

      <DashboardActionSection
        title="템플릿 작업"
        description="공개 템플릿 탐색과 포크 흐름을 먼저 배치했습니다."
        items={libraryCards}
        gridClassName="app-dashboard-action-grid--two"
      />

      <DashboardActionSection
        title="연결 흐름"
        description="템플릿 화면이 실제 시작 흐름과 어떻게 이어지는지 함께 정리했습니다."
        items={integrationCards}
        gridClassName="app-dashboard-action-grid--two"
      />
    </DashboardScreen>
  );
}
