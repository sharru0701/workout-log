"use client";

import type { CSSProperties, ReactNode } from "react";
import { V2Icon } from "./v2-icon";

export type V2SelectableRowProps = {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: string;
  trailing?: ReactNode;
  /** "single" renders a check_circle when selected (radio-like).
   *  "multi" renders a square check_box / check_box_outline_blank (checkbox-like). */
  mode?: "single" | "multi";
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function V2SelectableRow({
  selected,
  onClick,
  title,
  description,
  icon,
  trailing,
  mode = "single",
  disabled,
  className,
  style,
}: V2SelectableRowProps) {
  const indicatorIcon = trailing
    ? null
    : mode === "multi"
      ? selected
        ? "check_box"
        : "check_box_outline_blank"
      : selected
        ? "check_circle"
        : null;

  return (
    <button
      type="button"
      role={mode === "multi" ? "checkbox" : "radio"}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={["v2-pressable", "v2-selectable-row", className]
        .filter(Boolean)
        .join(" ")}
      data-selected={selected || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--v2-s-3)",
        width: "100%",
        minHeight: "var(--v2-s-9)",
        padding: "var(--v2-s-4)",
        borderRadius: "var(--v2-r-3)",
        background: selected ? "var(--v2-accent-weak)" : "var(--v2-paper)",
        boxShadow: selected
          ? "inset 0 0 0 2px var(--v2-accent)"
          : "var(--v2-elev-1)",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        border: "none",
        transition:
          "background var(--v2-d-2) var(--v2-e-out), box-shadow var(--v2-d-2) var(--v2-e-out)",
        ...style,
      }}
    >
      {icon ? (
        <V2Icon
          name={icon}
          fill
          weight={500}
          style={{
            fontSize: "var(--v2-t-h2)",
            color: selected ? "var(--v2-accent)" : "var(--v2-ink-3)",
            flexShrink: 0,
          }}
        />
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          className="v2-h3"
          style={{
            margin: 0,
            color: selected ? "var(--v2-accent-ink)" : "var(--v2-ink)",
          }}
        >
          {title}
        </p>
        {description ? (
          <p
            className="v2-small"
            style={{
              margin: 0,
              marginTop: "var(--v2-s-1)",
              color: "var(--v2-ink-3)",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {trailing ? (
        <div style={{ flexShrink: 0 }}>{trailing}</div>
      ) : indicatorIcon ? (
        <V2Icon
          name={indicatorIcon}
          style={{
            fontSize: "var(--v2-t-h2)",
            color: selected ? "var(--v2-accent)" : "var(--v2-ink-4)",
            flexShrink: 0,
          }}
        />
      ) : null}
    </button>
  );
}
