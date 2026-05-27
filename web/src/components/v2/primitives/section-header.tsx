"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type V2SectionHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  level?: "h1" | "h2" | "h3";
  onTitleClick?: () => void;
  titleDisabled?: boolean;
  titleAriaLabel?: string;
  titleAriaExpanded?: boolean;
  titleAriaHasPopup?: ButtonHTMLAttributes<HTMLButtonElement>["aria-haspopup"];
};

export function V2SectionHeader({
  eyebrow,
  title,
  description,
  action,
  level = "h2",
  onTitleClick,
  titleDisabled = false,
  titleAriaLabel,
  titleAriaExpanded,
  titleAriaHasPopup,
}: V2SectionHeaderProps) {
  const titleClass =
    level === "h1" ? "v2-h1" : level === "h3" ? "v2-h3" : "v2-h2";
  const TitleTag = level;

  const showIndicator = Boolean(onTitleClick) && !titleDisabled;

  const titleInner = onTitleClick ? (
    <button
      type="button"
      onClick={titleDisabled ? undefined : onTitleClick}
      disabled={titleDisabled}
      aria-label={titleAriaLabel}
      aria-expanded={titleAriaExpanded}
      aria-haspopup={titleAriaHasPopup}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--v2-s-2)",
        width: "100%",
        background: "transparent",
        border: 0,
        padding: 0,
        margin: 0,
        font: "inherit",
        color: "inherit",
        letterSpacing: "inherit",
        textAlign: "left",
        cursor: titleDisabled ? "default" : "pointer",
      }}
    >
      <span style={{ minWidth: 0, flex: 1 }}>{title}</span>
      {showIndicator ? (
        <span
          className="material-symbols-outlined"
          aria-hidden
          style={{
            fontSize: "var(--v2-t-h3)",
            color: "var(--v2-ink-3)",
            flexShrink: 0,
          }}
        >
          unfold_more
        </span>
      ) : null}
    </button>
  ) : (
    title
  );

  return (
    <div
      className="v2-section-header"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "var(--v2-s-3)",
        marginBottom: "var(--v2-s-4)",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        {eyebrow ? (
          <p className="v2-eyebrow" style={{ marginBottom: 4 }}>
            {eyebrow}
          </p>
        ) : null}
        <TitleTag className={titleClass}>{titleInner}</TitleTag>
        {description ? (
          <p
            className="v2-small"
            style={{
              marginTop: "var(--v2-s-2)",
              color: "var(--v2-ink-2)",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}
