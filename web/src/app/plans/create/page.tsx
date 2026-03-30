import Link from "next/link";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { APP_ROUTES } from "@/lib/app-routes";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  description: string;
  iconSymbol: string;
};

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

export default async function PlanCreatePage() {
  const locale = await resolveRequestLocale();
  const creationItems: NavItem[] = [
    {
      href: APP_ROUTES.programStore,
      label: locale === "ko" ? "프로그램 고르고 시작" : "Choose a Program",
      subtitle: "Recommended",
      description: locale === "ko" ? "프로그램 스토어에서 프로그램을 선택하면 플랜이 생성되고 바로 시작 흐름으로 이어집니다." : "Pick a program from the store and continue directly into plan setup.",
      iconSymbol: "library_books",
    },
    {
      href: APP_ROUTES.programCreate,
      label: locale === "ko" ? "커스텀 프로그램 만들기" : "Create a Custom Program",
      subtitle: "Custom",
      description: locale === "ko" ? "내 루틴을 직접 만들고 플랜으로 바로 연결합니다." : "Build your own routine and turn it into a plan.",
      iconSymbol: "add_circle",
    },
    {
      href: APP_ROUTES.plansContext,
      label: locale === "ko" ? "생성 기준 점검" : "Review Generation Rules",
      subtitle: "Advanced",
      description: locale === "ko" ? "날짜, 시간대, 세션 키 기준을 먼저 확인해야 할 때 사용합니다." : "Use this when you need to review dates, time zones, and session-key rules first.",
      iconSymbol: "tune",
    },
    {
      href: APP_ROUTES.plansManage,
      label: locale === "ko" ? "기존 플랜 관리" : "Manage Existing Plans",
      subtitle: "Manage",
      description: locale === "ko" ? "이미 있는 플랜은 생성이 아니라 관리 화면에서 다룹니다." : "Use the management screen for plans you already have.",
      iconSymbol: "assignment",
    },
  ];
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
          Plan Setup
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
          {locale === "ko" ? "새 플랜 시작하기" : "Start a New Plan"}
        </h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
          {locale === "ko" ? "실제 시작은 프로그램 스토어에서 고르거나 커스텀 프로그램을 만드는 흐름으로 진행됩니다." : "Start by choosing a program from the store or creating a custom one."}
        </p>
      </div>

      {/* Creation Items */}
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
          {locale === "ko" ? "시작 경로" : "Start Paths"}
        </h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {creationItems.map((item) => (
          <NavRow key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
