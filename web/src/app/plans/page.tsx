import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";
import { getAppCopy, resolveRequestLocale } from "@/lib/i18n/messages";

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

export default async function PlansIndexPage() {
  const locale = await resolveRequestLocale();
  const copy = getAppCopy(locale);
  const managementItems: NavItem[] = [
    {
      href: APP_ROUTES.plansManage,
      label: copy.plans.managementItems.active.label,
      subtitle: copy.plans.managementItems.active.subtitle,
      description: copy.plans.managementItems.active.description,
      iconSymbol: "assignment",
    },
    {
      href: APP_ROUTES.plansHistory,
      label: copy.plans.managementItems.history.label,
      subtitle: copy.plans.managementItems.history.subtitle,
      description: copy.plans.managementItems.history.description,
      iconSymbol: "history",
    },
  ];
  const setupItems: NavItem[] = [
    {
      href: APP_ROUTES.programStore,
      label: copy.plans.setupItems.store.label,
      subtitle: copy.plans.setupItems.store.subtitle,
      description: copy.plans.setupItems.store.description,
      iconSymbol: "library_books",
    },
    {
      href: APP_ROUTES.programCreate,
      label: copy.plans.setupItems.custom.label,
      subtitle: copy.plans.setupItems.custom.subtitle,
      description: copy.plans.setupItems.custom.description,
      iconSymbol: "add_circle",
    },
    {
      href: APP_ROUTES.plansContext,
      label: copy.plans.setupItems.advanced.label,
      subtitle: copy.plans.setupItems.advanced.subtitle,
      description: copy.plans.setupItems.advanced.description,
      iconSymbol: "tune",
    },
  ];

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
            {copy.plans.headerEyebrow}
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
            {copy.plans.title}
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
          {copy.plans.manage}
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
            {copy.plans.managementSection}
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
            {copy.plans.setupSection}
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
