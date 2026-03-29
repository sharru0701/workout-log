import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  description: string;
  iconSymbol: string;
};

const libraryItems: NavItem[] = [
  {
    href: APP_ROUTES.templatesManage,
    label: "템플릿 둘러보기",
    subtitle: "Library",
    description: "공개 템플릿과 개인 템플릿을 한곳에서 확인합니다.",
    iconSymbol: "style",
  },
  {
    href: APP_ROUTES.templatesManage,
    label: "포크 후 수정",
    subtitle: "Fork & Edit",
    description: "공개 템플릿을 복사해 내 작업공간에서 수정합니다.",
    iconSymbol: "fork_right",
  },
];

const integrationItems: NavItem[] = [
  {
    href: APP_ROUTES.programStore,
    label: "프로그램 스토어로 연결",
    subtitle: "Program Store",
    description: "템플릿 기반 프로그램을 고르고 플랜 시작 흐름으로 이어갑니다.",
    iconSymbol: "library_books",
  },
  {
    href: APP_ROUTES.programCreate,
    label: "커스텀 프로그램 만들기",
    subtitle: "Custom",
    description: "템플릿 대신 내 루틴을 직접 정의하고 싶을 때 같은 시작 흐름으로 이동합니다.",
    iconSymbol: "add_circle",
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

export default function TemplatesIndexPage() {
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
            Templates
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
            프로그램 템플릿
          </h1>
        </div>
        <Link
          href={APP_ROUTES.templatesManage}
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
            style
          </span>
          관리
        </Link>
      </div>

      {/* Library Section */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
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
          템플릿 작업
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {libraryItems.map((item) => (
            <NavRow key={`${item.href}-${item.iconSymbol}`} item={item} />
          ))}
        </div>
      </div>

      {/* Integration Section */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
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
          연결 흐름
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {integrationItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
