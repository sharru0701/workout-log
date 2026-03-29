import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  description: string;
  iconSymbol: string;
};

const managementItems: NavItem[] = [
  {
    href: APP_ROUTES.plansManage,
    label: "보유 플랜 관리",
    subtitle: "Active Plans",
    description: "운영 중인 플랜 목록 · 오늘 운동 연결 · 삭제",
    iconSymbol: "assignment",
  },
  {
    href: APP_ROUTES.plansHistory,
    label: "수행 히스토리",
    subtitle: "History",
    description: "플랜별 수행 로그와 진행 흐름",
    iconSymbol: "history",
  },
];

const setupItems: NavItem[] = [
  {
    href: APP_ROUTES.programStore,
    label: "프로그램에서 새 플랜 시작",
    subtitle: "Program Store",
    description: "프로그램을 고르고 바로 플랜으로 연결",
    iconSymbol: "library_books",
  },
  {
    href: APP_ROUTES.programCreate,
    label: "커스텀 프로그램 만들기",
    subtitle: "Custom",
    description: "내 루틴을 직접 만들고 플랜으로 시작",
    iconSymbol: "add_circle",
  },
  {
    href: APP_ROUTES.plansContext,
    label: "생성 기준 확인",
    subtitle: "Advanced",
    description: "날짜, 세션 키 규칙 등 고급 생성 기준 점검",
    iconSymbol: "tune",
  },
];

function NavRow({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-md)",
        padding: "14px 16px",
        borderRadius: "14px",
        background: "var(--color-surface-container-low)",
        textDecoration: "none",
        transition: "background 0.12s ease",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 22,
          color: "var(--color-primary)",
          flexShrink: 0,
          fontVariationSettings: "'FILL' 0, 'wght' 300",
        }}
        aria-hidden="true"
      >
        {item.iconSymbol}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "var(--font-label)",
            fontFamily: "var(--font-label-family)",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-primary)",
            marginBottom: "1px",
          }}
        >
          {item.subtitle}
        </div>
        <div
          style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.1px",
            marginBottom: "2px",
          }}
        >
          {item.label}
        </div>
        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
          {item.description}
        </div>
      </div>

      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 18,
          color: "var(--color-text-muted)",
          opacity: 0.5,
          flexShrink: 0,
          fontVariationSettings: "'FILL' 0, 'wght' 300",
        }}
        aria-hidden="true"
      >
        chevron_right
      </span>
    </Link>
  );
}

export default function PlansIndexPage() {
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "var(--space-xl)",
          paddingBottom: "var(--space-md)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-label-family)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-primary)",
              marginBottom: "4px",
            }}
          >
            Training Plans
          </div>
          <h1
            style={{
              fontFamily: "var(--font-headline-family)",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            플랜 관리
          </h1>
        </div>
        <Link
          href={APP_ROUTES.plansManage}
          style={{
            fontFamily: "var(--font-label-family)",
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--color-primary)",
            textDecoration: "none",
            marginTop: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            aria-hidden="true"
          >
            assignment
          </span>
          관리
        </Link>
      </div>

      {/* Management Section */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ marginBottom: "var(--space-sm)" }}>
          <h2
            style={{
              fontFamily: "var(--font-headline-family)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            플랜 운영
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {managementItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* Setup Section */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ marginBottom: "var(--space-sm)" }}>
          <h2
            style={{
              fontFamily: "var(--font-headline-family)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            새 플랜 시작
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {setupItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
