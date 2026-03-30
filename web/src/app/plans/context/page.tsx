import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";
import { getAppCopy, resolveRequestLocale } from "@/lib/i18n/messages";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string, fallback: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  return raw ?? fallback;
}

function readPositiveInt(params: SearchParams, key: string, fallback: number) {
  const parsed = Number(readString(params, key, String(fallback)));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function toSelectionHref(pathname: string, returnTo: string) {
  const sp = new URLSearchParams();
  sp.set("returnTo", returnTo);
  return `${pathname}?${sp.toString()}`;
}

type SettingItem = {
  href: string;
  label: string;
  description: string;
  currentValue: string;
  iconSymbol: string;
};

function SettingRow({ item }: { item: SettingItem }) {
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
        minHeight: "60px",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 20,
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
            fontFamily: "var(--font-headline-family)",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--color-text)",
            letterSpacing: "-0.1px",
            marginBottom: "2px",
          }}
        >
          {item.label}
        </div>
        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.3 }}>
          {item.description}
        </div>
      </div>

      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            fontFamily: "var(--font-label-family)",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            maxWidth: "80px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.currentValue}
        </span>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 16,
            color: "var(--color-text-muted)",
            opacity: 0.5,
            fontVariationSettings: "'FILL' 0, 'wght' 300",
          }}
          aria-hidden="true"
        >
          chevron_right
        </span>
      </div>
    </Link>
  );
}

export default async function PlanContextPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const locale = await resolveRequestLocale();
  const copy = getAppCopy(locale);
  const params = searchParams ? await searchParams : {};
  const userId = readString(params, "userId", "dev");
  const startDate = readString(params, "startDate", new Date().toISOString().slice(0, 10));
  const timezone = readString(params, "timezone", "UTC");
  const sessionKeyMode = readString(params, "sessionKeyMode", "DATE");
  const week = readPositiveInt(params, "week", 1);
  const day = readPositiveInt(params, "day", 1);

  const returnQuery = new URLSearchParams();
  returnQuery.set("userId", userId);
  returnQuery.set("startDate", startDate);
  returnQuery.set("timezone", timezone);
  returnQuery.set("sessionKeyMode", sessionKeyMode);
  returnQuery.set("week", String(week));
  returnQuery.set("day", String(day));
  const returnTo = `${APP_ROUTES.plansContext}?${returnQuery.toString()}`;

  const contextItems: SettingItem[] = [
    {
      href: toSelectionHref("/plans/context/select/user-id", returnTo),
      label: copy.plansContext.fields.userId.label,
      description: copy.plansContext.fields.userId.description,
      currentValue: userId,
      iconSymbol: "person",
    },
    {
      href: toSelectionHref("/plans/context/picker/start-date", returnTo),
      label: copy.plansContext.fields.startDate.label,
      description: copy.plansContext.fields.startDate.description,
      currentValue: startDate,
      iconSymbol: "calendar_today",
    },
    {
      href: toSelectionHref("/plans/context/select/timezone", returnTo),
      label: copy.plansContext.fields.timezone.label,
      description: copy.plansContext.fields.timezone.description,
      currentValue: timezone,
      iconSymbol: "schedule",
    },
    {
      href: toSelectionHref("/plans/context/select/session-key-mode", returnTo),
      label: copy.plansContext.fields.sessionKeyMode.label,
      description: copy.plansContext.fields.sessionKeyMode.description,
      currentValue: sessionKeyMode,
      iconSymbol: "key",
    },
    {
      href: toSelectionHref("/plans/context/picker/week", returnTo),
      label: copy.plansContext.fields.week.label,
      description: copy.plansContext.fields.week.description,
      currentValue: String(week),
      iconSymbol: "view_week",
    },
    {
      href: toSelectionHref("/plans/context/picker/day", returnTo),
      label: copy.plansContext.fields.day.label,
      description: copy.plansContext.fields.day.description,
      currentValue: String(day),
      iconSymbol: "today",
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
          {copy.plansContext.eyebrow}
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
          {copy.plansContext.title}
        </h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-md)", lineHeight: 1.5 }}>
          {copy.plansContext.description}
        </p>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <Link
            href={APP_ROUTES.programStore}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-primary)",
              color: "var(--color-text-on-primary)",
              borderRadius: "22px",
              padding: "10px 16px",
              fontFamily: "var(--font-label-family)",
              fontWeight: 700,
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            {copy.plansContext.pickProgram}
          </Link>
          <Link
            href={APP_ROUTES.programCreate}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-surface-container-high)",
              color: "var(--color-text)",
              borderRadius: "22px",
              padding: "10px 16px",
              fontFamily: "var(--font-label-family)",
              fontWeight: 600,
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            {copy.plansContext.createCustom}
          </Link>
        </div>
      </div>

      {/* Context Items */}
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
        {copy.plansContext.sectionTitle}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {contextItems.map((item) => (
          <SettingRow key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
