import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  description: string;
  accentColor: string;
  symbol: string;
};

const managementItems: NavItem[] = [
  {
    href: APP_ROUTES.plansManage,
    label: "보유 플랜 관리",
    subtitle: "Active Plans",
    description: "운영 중인 플랜 목록 · 오늘 운동 연결 · 삭제",
    accentColor: "var(--color-action)",
    symbol: "PM",
  },
  {
    href: APP_ROUTES.plansHistory,
    label: "수행 히스토리",
    subtitle: "History",
    description: "플랜별 수행 로그와 진행 흐름",
    accentColor: "var(--color-text-muted)",
    symbol: "HS",
  },
];

const setupItems: NavItem[] = [
  {
    href: APP_ROUTES.programStore,
    label: "프로그램에서 새 플랜 시작",
    subtitle: "Program Store",
    description: "프로그램을 고르고 바로 플랜으로 연결",
    accentColor: "var(--color-success)",
    symbol: "ST",
  },
  {
    href: APP_ROUTES.programCreate,
    label: "커스텀 프로그램 만들기",
    subtitle: "Custom",
    description: "내 루틴을 직접 만들고 플랜으로 시작",
    accentColor: "var(--color-cta)",
    symbol: "CP",
  },
  {
    href: APP_ROUTES.plansContext,
    label: "생성 기준 확인",
    subtitle: "Advanced",
    description: "날짜, 세션 키 규칙 등 고급 생성 기준 점검",
    accentColor: "var(--color-text-muted)",
    symbol: "CX",
  },
];

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: "var(--space-sm)" }}>
      <div style={{
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
        marginBottom: "2px",
      }}>
        {eyebrow}
      </div>
      <h2 style={{
        fontSize: "15px",
        fontWeight: 800,
        letterSpacing: "-0.2px",
        color: "var(--color-text)",
        margin: 0,
      }}>
        {title}
      </h2>
    </div>
  );
}

function NavRow({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-md)",
        padding: "14px 16px",
        borderRadius: "12px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        textDecoration: "none",
        transition: "background 0.12s ease",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
      }}
    >
      {/* Symbol badge */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: `color-mix(in srgb, ${item.accentColor} 12%, var(--color-surface))`,
        border: `1px solid color-mix(in srgb, ${item.accentColor} 25%, var(--color-border))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "0.03em",
        color: item.accentColor,
      }}>
        {item.symbol}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: item.accentColor, marginBottom: "1px" }}>
          {item.subtitle}
        </div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.1px", marginBottom: "2px" }}>
          {item.label}
        </div>
        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
          {item.description}
        </div>
      </div>

      {/* Chevron */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0, color: "var(--color-text-muted)", opacity: 0.5 }}>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

export default function PlansIndexPage() {
  return (
    <div>
      {/* ── Editorial Header ── */}
      <div style={{
        marginBottom: "var(--space-xl)",
        paddingBottom: "var(--space-md)",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <div style={{
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-action)",
          marginBottom: "4px",
        }}>
          Training Plans
        </div>
        <h1 style={{
          fontSize: "28px",
          fontWeight: 800,
          letterSpacing: "-0.5px",
          color: "var(--color-text)",
          margin: 0,
        }}>
          플랜 관리
        </h1>
        <p style={{
          fontSize: "13px",
          color: "var(--color-text-muted)",
          marginTop: "4px",
          lineHeight: 1.5,
        }}>
          운영 중인 플랜을 관리하거나 새 플랜을 시작합니다.
        </p>
      </div>

      {/* ── Primary CTA ── */}
      <Link
        href={APP_ROUTES.plansManage}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          width: "100%",
          padding: "16px",
          borderRadius: "14px",
          background: "var(--color-action)",
          color: "#fff",
          textDecoration: "none",
          fontSize: "15px",
          fontWeight: 800,
          letterSpacing: "-0.1px",
          marginBottom: "var(--space-xl)",
          boxShadow: "0 2px 8px color-mix(in srgb, var(--color-action) 30%, transparent)",
          transition: "opacity 0.12s ease",
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
          <rect x="3.5" y="4" width="17" height="16.5" rx="2" />
          <path d="M3.5 9.5h17M7.5 13.5h4M7.5 17.5h4M14.5 12.5l1 1 2.5-2M14.5 16.5l1 1 2.5-2" />
        </svg>
        보유 플랜 관리
      </Link>

      {/* ── Management Section ── */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <SectionTitle eyebrow="Manage" title="플랜 운영" />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {managementItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* ── Setup Section ── */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <SectionTitle eyebrow="Setup" title="새 플랜 시작" />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {setupItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
