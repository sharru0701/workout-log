import Link from "next/link";
import {
  DashboardActionSection,
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
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Plan Setup</span>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "2px 0 6px" }}>새 플랜 시작하기</h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-md)", lineHeight: 1.4 }}>실제 시작은 프로그램 스토어에서 고르거나 커스텀 프로그램을 만드는 흐름으로 진행됩니다.</p>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <Link href={APP_ROUTES.programStore} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-action)", color: "#fff", borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: "14px", textDecoration: "none", letterSpacing: "-0.1px" }}>
            프로그램 고르기
          </Link>
          <Link href={APP_ROUTES.programCreate} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-2)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: "14px", textDecoration: "none" }}>
            커스텀 만들기
          </Link>
        </div>
      </div>

      <DashboardActionSection
        title="시작 경로"
        description="앱에서 실제로 쓰이는 새 플랜 시작 경로만 남겼습니다."
        items={creationCards}
      />
    </DashboardScreen>
  );
}
