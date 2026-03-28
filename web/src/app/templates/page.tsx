import Link from "next/link";
import {
  DashboardActionSection,
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
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Templates</span>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "2px 0 6px" }}>프로그램 템플릿</h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-md)", lineHeight: 1.4 }}>템플릿은 직접 기록 화면으로 가지 않고, 프로그램 생성과 커스터마이징의 재료 역할을 합니다.</p>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <Link href={APP_ROUTES.templatesManage} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-action)", color: "#fff", borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: "14px", textDecoration: "none", letterSpacing: "-0.1px" }}>
            템플릿 관리
          </Link>
          <Link href={APP_ROUTES.programStore} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-2)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: "14px", textDecoration: "none" }}>
            프로그램 스토어
          </Link>
        </div>
      </div>

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
