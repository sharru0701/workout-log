import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  description: string;
  iconSymbol: string;
};

const primaryItems: NavItem[] = [
  {
    href: APP_ROUTES.todayLog,
    label: "오늘 기록 열기",
    subtitle: "Today's Log",
    description: "선택한 플랜으로 세션을 만들고 세트 입력과 저장을 이어갑니다.",
    iconSymbol: "fitness_center",
  },
  {
    href: APP_ROUTES.programStore,
    label: "프로그램/플랜 준비",
    subtitle: "Programs",
    description: "보유 플랜이 없으면 먼저 프로그램을 고르거나 직접 만들고 오늘 운동으로 들어갑니다.",
    iconSymbol: "library_books",
  },
];

const toolItems: NavItem[] = [
  {
    href: APP_ROUTES.calendarHome,
    label: "날짜로 열기",
    subtitle: "Calendar",
    description: "오늘이 아닌 특정 날짜 기준으로 세션을 열거나 생성합니다.",
    iconSymbol: "calendar_today",
  },
  {
    href: APP_ROUTES.todayOverrides,
    label: "세션 조정",
    subtitle: "Overrides",
    description: "교체 운동과 보조 운동 규칙을 세밀하게 조정합니다.",
    iconSymbol: "tune",
  },
  {
    href: APP_ROUTES.workoutRecord,
    label: "기록 워크스페이스",
    subtitle: "Record",
    description: "플랜 기반 기록을 다시 보거나 세부 편집이 필요할 때 사용합니다.",
    iconSymbol: "edit_note",
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

export default function WorkoutTodayIndexPage() {
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
            Workout
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
            오늘 운동
          </h1>
        </div>
        <Link
          href={APP_ROUTES.todayLog}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 16px",
            borderRadius: "22px",
            background: "var(--color-primary)",
            color: "var(--color-text-on-primary)",
            fontFamily: "var(--font-label-family)",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 500" }}
            aria-hidden="true"
          >
            play_arrow
          </span>
          기록 시작
        </Link>
      </div>

      {/* Primary Section */}
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
            핵심 동선
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {primaryItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* Tools Section */}
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
            보조 도구
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {toolItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
