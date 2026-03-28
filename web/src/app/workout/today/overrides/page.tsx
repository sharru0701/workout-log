import Link from "next/link";
import {
  DashboardActionSection,
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
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Session Adjustments</span>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "2px 0 6px" }}>세션 오버라이드</h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-md)", lineHeight: 1.4 }}>오버라이드는 독립된 시작 화면이 아니라 오늘 기록 중 필요할 때 쓰는 보조 기능입니다.</p>
        <Link href={APP_ROUTES.todayLog} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-action)", color: "#fff", borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: "14px", textDecoration: "none", letterSpacing: "-0.1px" }}>
          오늘 기록으로 돌아가기
        </Link>
      </div>

      <DashboardActionSection
        title="오버라이드 동작"
        description="실제 변경 작업은 오늘 기록 화면으로 이어지도록 카드에 명시했습니다."
        items={overrideCards}
        gridClassName="app-dashboard-action-grid--two"
      />
    </DashboardScreen>
  );
}
