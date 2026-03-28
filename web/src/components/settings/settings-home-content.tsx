"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import {
  BaseGroupedList,
  NavigationRow,
  SectionHeader,
  SectionFootnote,
} from "@/components/ui/settings-list";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

// ─── Icon Primitives ──────────────────────────────────────────────

function SettingIcon({ d, viewBox = "0 0 24 24", fill = false }: { d: string | string[]; viewBox?: string; fill?: boolean }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      viewBox={viewBox}
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 20, height: 20 }}
      aria-hidden="true"
    >
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

// ─── SVG Icons for each setting row ──────────────────────────────

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function PlateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <ellipse cx="12" cy="12" rx="3" ry="7" />
      <ellipse cx="12" cy="12" rx="3" ry="7" transform="rotate(90 12 12)" />
      <path d="M5 12h2M17 12h2" />
    </svg>
  );
}

function BodyweightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
    </svg>
  );
}

function CatalogIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M4 6h16M4 10h16M4 14h10M4 18h6" />
    </svg>
  );
}

function DataIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function SystemStatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M7 10l2.5 2.5L13 9l4 3" />
    </svg>
  );
}

// ─── Section definitions ──────────────────────────────────────────

const appearanceRows = [
  {
    href: "/settings/theme",
    label: "테마",
    subtitle: "Theme",
    description: "라이트 / 다크 / 시스템",
    Icon: ThemeIcon,
  },
];

const workoutRows = [
  {
    href: "/settings/minimum-plate",
    label: "최소 원판 무게",
    subtitle: "Minimum Plate",
    description: "종목별 최소 원판 단위 설정",
    Icon: PlateIcon,
  },
  {
    href: "/settings/bodyweight",
    label: "몸무게",
    subtitle: "Bodyweight",
    description: "자중 운동 하중 계산에 사용",
    Icon: BodyweightIcon,
  },
  {
    href: "/settings/exercise-management",
    label: "운동종목 관리",
    subtitle: "Exercise Catalog",
    description: "종목 조회 · 추가 · 수정 · 삭제",
    Icon: CatalogIcon,
  },
];

const dataRows = [
  {
    href: "/settings/data",
    label: "데이터 관리",
    subtitle: "Data",
    description: "Export · 앱 데이터 초기화",
    Icon: DataIcon,
  },
];

const aboutRows = [
  {
    href: "/settings/about",
    label: "앱 정보",
    subtitle: "About",
    description: `v${process.env.NEXT_PUBLIC_APP_VERSION ?? ""}`,
    Icon: AboutIcon,
  },
  {
    href: "/settings/system-stats",
    label: "시스템 통계",
    subtitle: "System",
    description: "마이그레이션 및 UX 분석 (관리자)",
    Icon: SystemStatsIcon,
  },
];

function SettingsSection({ title, rows }: { title: string; rows: typeof workoutRows }) {
  return (
    <div style={{ marginBottom: "var(--space-xl)" }}>
      <div
        style={{
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          padding: "0 4px",
          marginBottom: "var(--space-xs)",
        }}
      >
        {title}
      </div>
      <BaseGroupedList ariaLabel={`${title} 설정`}>
        {rows.map((row) => (
          <NavigationRow
            key={row.href}
            href={row.href}
            label={row.label}
            subtitle={row.subtitle}
            description={row.description}
            value="열기"
            leading={
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-text-muted)",
                  flexShrink: 0,
                }}
              >
                <row.Icon />
              </div>
            }
          />
        ))}
      </BaseGroupedList>
    </div>
  );
}

export function SettingsHomeContent({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pullToRefresh = usePullToRefresh({
    onRefresh: () => {
      router.refresh();
    },
  });

  return (
    <PullToRefreshShell
      pullToRefresh={pullToRefresh}
      className={className || undefined}
    >
      {/* ── Page Header ── */}
      <div
        style={{
          marginBottom: "var(--space-xl)",
          paddingBottom: "var(--space-md)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-action)",
            marginBottom: "4px",
          }}
        >
          Preferences
        </div>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
            marginTop: "4px",
            lineHeight: 1.5,
          }}
        >
          앱 동작, 데이터, 기록 보조 설정을 관리합니다.
        </p>
      </div>

      {/* ── Quick Links — Plans & Store (removed from nav) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-sm)",
          marginBottom: "var(--space-xl)",
        }}
      >
        <Link
          href="/plans"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "14px",
            borderRadius: "12px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            textDecoration: "none",
            transition: "background 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-action)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <rect x="3.5" y="4" width="17" height="16.5" rx="2"/>
              <path d="M3.5 9.5h17M7.5 13.5h4M7.5 17.5h4M14.5 12.5l1 1 2.5-2M14.5 16.5l1 1 2.5-2"/>
            </svg>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>플랜</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>플랜 관리 및 히스토리</div>
        </Link>
        <Link
          href="/program-store"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "14px",
            borderRadius: "12px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            textDecoration: "none",
            transition: "background 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-cta)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <path d="M6 2.5L3 8.5h18l-3-6H6z"/>
              <path d="M3 8.5v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-11M9 12.5a3 3 0 0 0 6 0"/>
            </svg>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>스토어</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>프로그램 선택 및 시작</div>
        </Link>
      </div>

      {/* ── Grouped Sections ── */}
      <SettingsSection title="외관" rows={appearanceRows} />
      <SettingsSection title="운동 설정" rows={workoutRows} />
      <SettingsSection title="데이터" rows={dataRows} />
      <SettingsSection title="앱 정보" rows={aboutRows} />

      <SectionFootnote>
        모든 설정은 저장 즉시 반영되며, 실패 시 안내와 함께 이전 값으로 복구됩니다.
      </SectionFootnote>
    </PullToRefreshShell>
  );
}
