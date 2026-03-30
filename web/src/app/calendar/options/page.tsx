import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";
import { getAppCopy, resolveRequestLocale } from "@/lib/i18n/messages";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string, fallback: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  return raw ?? fallback;
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

export default async function CalendarOptionsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const locale = await resolveRequestLocale();
  const copy = getAppCopy(locale);
  const params = searchParams ? await searchParams : {};
  const viewMode = readString(params, "viewMode", "month");
  const timezone = readString(params, "timezone", "UTC");
  const autoOpenMode = readString(params, "autoOpen", "OPEN_ONLY");
  const openTime = readString(params, "openTime", "08:00");

  const returnQuery = new URLSearchParams();
  returnQuery.set("viewMode", viewMode);
  returnQuery.set("timezone", timezone);
  returnQuery.set("autoOpen", autoOpenMode);
  returnQuery.set("openTime", openTime);
  const returnTo = `${APP_ROUTES.calendarOptions}?${returnQuery.toString()}`;

  const optionItems: SettingItem[] = [
    {
      href: toSelectionHref("/calendar/options/select/view-mode", returnTo),
      label: copy.calendarOptions.fields.viewMode.label,
      description: copy.calendarOptions.fields.viewMode.description,
      currentValue: viewMode,
      iconSymbol: "grid_view",
    },
    {
      href: toSelectionHref("/calendar/options/select/timezone", returnTo),
      label: copy.calendarOptions.fields.timezone.label,
      description: copy.calendarOptions.fields.timezone.description,
      currentValue: timezone,
      iconSymbol: "schedule",
    },
    {
      href: toSelectionHref("/calendar/options/select/auto-open", returnTo),
      label: copy.calendarOptions.fields.autoOpen.label,
      description: copy.calendarOptions.fields.autoOpen.description,
      currentValue: autoOpenMode === "AUTO_GENERATE" ? copy.calendarOptions.fields.autoOpen.autoGenerate : copy.calendarOptions.fields.autoOpen.openOnly,
      iconSymbol: "touch_app",
    },
    {
      href: toSelectionHref("/calendar/options/picker/open-time", returnTo),
      label: copy.calendarOptions.fields.openTime.label,
      description: copy.calendarOptions.fields.openTime.description,
      currentValue: openTime,
      iconSymbol: "access_time",
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
          {copy.calendarOptions.eyebrow}
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
          {copy.calendarOptions.title}
        </h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-md)", lineHeight: 1.5 }}>
          {copy.calendarOptions.description}
        </p>
        <Link
          href={APP_ROUTES.calendarHome}
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
          {copy.calendarOptions.backToCalendar}
        </Link>
      </div>

      {/* Option Items */}
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
        {copy.calendarOptions.sectionTitle}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {optionItems.map((item) => (
          <SettingRow key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
