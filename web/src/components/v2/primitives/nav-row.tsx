"use client";

import type { CSSProperties, ReactNode } from "react";
import { V2Icon } from "./v2-icon";

type CommonProps = {
  label: ReactNode;
  /** Material Symbols icon name (used when `leading` is not provided). */
  icon?: string;
  /** Arbitrary leading element (e.g. tinted icon badge). Overrides `icon`. */
  leading?: ReactNode;
  value?: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  /** "chevron" (default for interactive), "none" (hide indicator), or any ReactNode to render in trailing slot (e.g. toggle, custom indicator). */
  trailing?: "chevron" | "none" | ReactNode;
  className?: string;
  style?: CSSProperties;
};

type ButtonProps = CommonProps & {
  as?: "button";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  href?: never;
  expandable?: never;
  expanded?: never;
  onExpandedChange?: never;
  expandedContent?: never;
};

type AnchorProps = CommonProps & {
  as: "a";
  href: string;
  onClick?: never;
  type?: never;
  disabled?: never;
  expandable?: never;
  expanded?: never;
  onExpandedChange?: never;
  expandedContent?: never;
};

type DivProps = CommonProps & {
  as: "div";
  href?: never;
  onClick?: never;
  type?: never;
  disabled?: never;
  expandable?: never;
  expanded?: never;
  onExpandedChange?: never;
  expandedContent?: never;
};

type ExpandableProps = CommonProps & {
  as?: never;
  href?: never;
  type?: "button" | "submit";
  onClick?: never;
  disabled?: boolean;
  /** When true, the row toggles `expandedContent` instead of navigating. */
  expandable: true;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  expandedContent: ReactNode;
};

export function V2NavRow(
  props: ButtonProps | AnchorProps | DivProps | ExpandableProps,
) {
  const {
    label,
    icon,
    leading,
    value,
    badge,
    description,
    trailing = "chevron",
    className,
    style,
  } = props;
  const isExpandable = "expandable" in props && props.expandable === true;
  const interactive = isExpandable || props.as !== "div";

  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--v2-s-3)",
    width: "100%",
    minHeight: "var(--v2-s-9)",
    padding: "var(--v2-s-3) var(--v2-s-4)",
    background: "var(--v2-paper)",
    color: "var(--v2-ink)",
    border: "none",
    cursor: interactive ? "pointer" : "default",
    textDecoration: "none",
    textAlign: "left",
    borderRadius: "var(--v2-nav-row-radius, var(--v2-r-2))",
    transition: "background var(--v2-d-1) var(--v2-e-out)",
    ...style,
  };

  const cls = [interactive && "v2-pressable", "v2-nav-row", className]
    .filter(Boolean)
    .join(" ");

  const useCustomTrailing =
    trailing !== undefined && trailing !== "chevron" && trailing !== "none";
  const trailingIcon = isExpandable
    ? props.expanded
      ? "expand_less"
      : "expand_more"
    : useCustomTrailing || trailing === "none"
      ? null
      : "chevron_right";

  const inner = (
    <>
      {leading ? (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          {leading}
        </div>
      ) : icon ? (
        <V2Icon
          name={icon}
          style={{ fontSize: "var(--v2-t-h2)", color: "var(--v2-ink-2)" }}
        />
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="v2-body" style={{ margin: 0, fontWeight: 500 }}>
          {label}
        </p>
        {description ? (
          <p
            className="v2-small"
            style={{ margin: 0, color: "var(--v2-ink-3)" }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {badge ? <div style={{ flexShrink: 0 }}>{badge}</div> : null}
      {value !== undefined ? (
        <span
          className="v2-small"
          style={{ color: "var(--v2-ink-3)", flexShrink: 0 }}
        >
          {value}
        </span>
      ) : null}
      {useCustomTrailing ? (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          {trailing as ReactNode}
        </div>
      ) : interactive && trailingIcon ? (
        <V2Icon
          name={trailingIcon}
          style={{
            fontSize: "var(--v2-t-18)",
            color: "var(--v2-ink-3)",
            flexShrink: 0,
            transition: "transform var(--v2-d-1) var(--v2-e-out)",
          }}
        />
      ) : null}
    </>
  );

  if (isExpandable) {
    const expanded = props.expanded;
    const disabled = props.disabled;
    return (
      <div style={{ width: "100%" }}>
        <button
          type={props.type ?? "button"}
          onClick={() => {
            if (!disabled) props.onExpandedChange(!expanded);
          }}
          aria-expanded={expanded}
          disabled={disabled}
          className={cls}
          style={{
            ...baseStyle,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {inner}
        </button>
        {expanded ? (
          <div
            role="region"
            style={{
              padding: "var(--v2-s-2) var(--v2-s-4) var(--v2-s-3)",
              animation:
                "v2-fadeUp var(--v2-d-2) var(--v2-e-out) both",
            }}
          >
            {props.expandedContent}
          </div>
        ) : null}
      </div>
    );
  }

  if (props.as === "a") {
    return (
      <a href={props.href} className={cls} style={baseStyle}>
        {inner}
      </a>
    );
  }
  if (props.as === "div") {
    return (
      <div className={cls} style={baseStyle}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cls}
      style={{
        ...baseStyle,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      {inner}
    </button>
  );
}
