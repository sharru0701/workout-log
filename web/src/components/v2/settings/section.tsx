"use client";

import type { CSSProperties, ReactNode } from "react";

import { MINIMAL_COPY_MODE } from "@/lib/ui/minimal-copy";

export type V2SettingsSectionProps = {
  title: ReactNode;
  description?: ReactNode;
};

export function V2SettingsSection({ title, description }: V2SettingsSectionProps) {
  return (
    <header
      style={{
        padding: "0 var(--v2-s-1)",
        marginBottom: "var(--v2-s-2)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--v2-s-1)",
      }}
    >
      <h2 className="v2-eyebrow" style={{ margin: 0 }}>
        {title}
      </h2>
      {!MINIMAL_COPY_MODE && description ? (
        <p
          className="v2-small"
          style={{ margin: 0, color: "var(--v2-ink-3)" }}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}

export type V2SettingsGroupProps = {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
};

export function V2SettingsGroup({
  children,
  ariaLabel,
  className,
  style,
}: V2SettingsGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={["v2-settings-group", className].filter(Boolean).join(" ")}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--v2-s-2)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type V2SettingsFootnoteProps = {
  children: ReactNode;
  className?: string;
};

export function V2SettingsFootnote({
  children,
  className,
}: V2SettingsFootnoteProps) {
  if (MINIMAL_COPY_MODE) return null;
  return (
    <p
      className={["v2-small", className].filter(Boolean).join(" ")}
      style={{
        padding: "var(--v2-s-2) var(--v2-s-1) 0",
        color: "var(--v2-ink-3)",
        margin: 0,
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}

export type V2RowIconTone =
  | "neutral"
  | "surface"
  | "primary"
  | "success"
  | "warning"
  | "info";

export type V2RowIconProps = {
  symbol: ReactNode;
  tone?: V2RowIconTone;
  label?: string;
};

const ROW_ICON_TONE_STYLES: Record<V2RowIconTone, CSSProperties> = {
  primary: {
    backgroundColor:
      "color-mix(in srgb, var(--v2-accent) 14%, var(--v2-paper))",
    color: "var(--v2-accent-ink)",
  },
  info: {
    backgroundColor:
      "color-mix(in srgb, var(--v2-c-info) 14%, var(--v2-paper))",
    color: "var(--v2-c-info)",
  },
  success: {
    backgroundColor:
      "color-mix(in srgb, var(--v2-c-success) 14%, var(--v2-paper))",
    color: "var(--v2-c-success)",
  },
  warning: {
    backgroundColor:
      "color-mix(in srgb, var(--v2-c-warning) 14%, var(--v2-paper))",
    color: "var(--v2-c-warning)",
  },
  surface: {
    backgroundColor: "var(--v2-paper-2)",
    color: "var(--v2-ink)",
  },
  neutral: {
    backgroundColor: "var(--v2-paper-3)",
    color: "var(--v2-ink-2)",
  },
};

export function V2RowIcon({ symbol, tone = "neutral", label }: V2RowIconProps) {
  return (
    <span
      className="v2-row-icon"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "var(--v2-s-7)",
        height: "var(--v2-s-7)",
        borderRadius: "var(--v2-r-2)",
        fontSize: "var(--v2-t-small)",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
        ...ROW_ICON_TONE_STYLES[tone],
      }}
    >
      {symbol}
    </span>
  );
}

/** Merge subtitle + description into a single ReactNode for V2NavRow.description.
 *  Returns undefined when both are empty or MINIMAL_COPY_MODE is on. */
export function mergeRowSubtitle(
  subtitle?: ReactNode,
  description?: ReactNode,
): ReactNode {
  if (MINIMAL_COPY_MODE) return undefined;
  if (subtitle && description) {
    return (
      <>
        {subtitle}
        {" · "}
        {description}
      </>
    );
  }
  return subtitle ?? description ?? undefined;
}
