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

export default async function TemplatesIndexPage() {
  const locale = await resolveRequestLocale();
  const copy = getAppCopy(locale);
  const libraryItems: NavItem[] = [
    {
      href: APP_ROUTES.templatesManage,
      label: copy.templates.libraryItems.browse.label,
      subtitle: copy.templates.libraryItems.browse.subtitle,
      description: copy.templates.libraryItems.browse.description,
      iconSymbol: "style",
    },
    {
      href: APP_ROUTES.templatesManage,
      label: copy.templates.libraryItems.forkEdit.label,
      subtitle: copy.templates.libraryItems.forkEdit.subtitle,
      description: copy.templates.libraryItems.forkEdit.description,
      iconSymbol: "fork_right",
    },
  ];
  const integrationItems: NavItem[] = [
    {
      href: APP_ROUTES.programStore,
      label: copy.templates.integrationItems.store.label,
      subtitle: copy.templates.integrationItems.store.subtitle,
      description: copy.templates.integrationItems.store.description,
      iconSymbol: "library_books",
    },
    {
      href: APP_ROUTES.programCreate,
      label: copy.templates.integrationItems.custom.label,
      subtitle: copy.templates.integrationItems.custom.subtitle,
      description: copy.templates.integrationItems.custom.description,
      iconSymbol: "add_circle",
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
            {copy.templates.headerEyebrow}
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
            {copy.templates.title}
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
          {copy.templates.manage}
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
          {copy.templates.workSection}
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
          {copy.templates.flowSection}
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
