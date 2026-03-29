import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  description: string;
  iconSymbol: string;
};

const overrideItems: NavItem[] = [
  {
    href: APP_ROUTES.todayLog,
    label: "보조 운동 고정",
    subtitle: "Accessory Fix",
    description: "보조 운동 선택을 기본값으로 저장합니다. 오늘 기록 화면에서 적용됩니다.",
    iconSymbol: "push_pin",
  },
  {
    href: APP_ROUTES.todayLog,
    label: "운동 교체",
    subtitle: "Exercise Swap",
    description: "세션 대상 운동을 다른 운동으로 바꿉니다. 오늘 기록 화면에서 적용됩니다.",
    iconSymbol: "swap_horiz",
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

export default function WorkoutOverridesPage() {
  return (
    <div>
      {/* Header */}
      <div
        style={{
          marginBottom: "var(--space-xl)",
          paddingBottom: "var(--space-md)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
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
          Session Adjustments
        </div>
        <h1
          style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            color: "var(--color-text)",
            margin: "0 0 var(--space-sm)",
          }}
        >
          세션 오버라이드
        </h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-md)", lineHeight: 1.5 }}>
          오버라이드는 독립된 시작 화면이 아니라 오늘 기록 중 필요할 때 쓰는 보조 기능입니다.
        </p>
        <Link
          href={APP_ROUTES.todayLog}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 18px",
            borderRadius: "22px",
            background: "var(--color-primary)",
            color: "var(--color-text-on-primary)",
            fontFamily: "var(--font-label-family)",
            fontSize: "13px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 500" }}
            aria-hidden="true"
          >
            arrow_back
          </span>
          오늘 기록으로 돌아가기
        </Link>
      </div>

      {/* Override Items */}
      <div style={{ marginBottom: "var(--space-sm)" }}>
        <h2
          style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            margin: "0 0 var(--space-sm)",
          }}
        >
          오버라이드 동작
        </h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {overrideItems.map((item) => (
          <NavRow key={`${item.href}-${item.iconSymbol}`} item={item} />
        ))}
      </div>
    </div>
  );
}
