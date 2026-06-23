"use client";

import type { CSSProperties, ReactNode } from "react";
import { useThemeSkin } from "@/components/use-theme-skin";
import { V2Icon } from "./v2-icon";

type CommonProps = {
  children: ReactNode;
  icon?: string;
  full?: boolean;
  style?: CSSProperties;
  className?: string;
  tone?: "neutral" | "danger";
};

type ButtonProps = CommonProps & {
  as?: "button";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  href?: never;
};

type AnchorProps = CommonProps & {
  as: "a";
  href: string;
  onClick?: never;
  type?: never;
  disabled?: never;
};

export function V2SecondaryBtn(props: ButtonProps | AnchorProps) {
  const skin = useThemeSkin();
  if (skin === "terminal") return <SecondaryBtnTerminal {...props} />;
  const { children, icon, full = false, style, className, tone = "neutral" } = props;
  const bg =
    tone === "danger"
      ? "color-mix(in srgb, var(--v2-c-danger) 10%, var(--v2-paper-2))"
      : "var(--v2-paper-2)";
  const fg = tone === "danger" ? "var(--v2-c-danger)" : "var(--v2-ink)";
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--v2-s-1)",
    width: full ? "100%" : undefined,
    minHeight: "var(--v2-s-8)",
    padding: "var(--v2-s-3) var(--v2-s-5)",
    borderRadius: "var(--v2-r-2)",
    background: bg,
    color: fg,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "var(--v2-t-14)",
    textDecoration: "none",
    transition:
      "transform var(--v2-d-1) var(--v2-e-out), background var(--v2-d-1) var(--v2-e-out)",
    ...style,
  };
  const cls = [
    "v2-pressable",
    "v2-btn-secondary",
    "v2-font-display",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const inner = (
    <>
      {icon && (
        <V2Icon name={icon} style={{ fontSize: "var(--v2-t-18)" }} />
      )}
      {children}
    </>
  );

  if (props.as === "a") {
    return (
      <a href={props.href} className={cls} style={baseStyle}>
        {inner}
      </a>
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

// ─── terminal(ironlog) 변형 ─────────────────────────────────────────────────
// 기존 terminal 키힌트 표준과 동일하게: bracket [ ] 텍스트 + 투명 + inset 1px outline.
// primary와 달리 ▶ 프롬프트 없음, 테두리는 흐린 line-box(amber 강조는 primary 전용).
// danger tone은 red 글자·red outline.
function SecondaryBtnTerminal(props: ButtonProps | AnchorProps) {
  const { children, icon, full = false, style, className, tone = "neutral" } = props;
  const danger = tone === "danger";
  const disabled = props.as !== "a" && Boolean(props.disabled);
  const fg = danger ? "var(--term-red)" : "var(--term-fg)";
  const line = danger ? "var(--term-red)" : "var(--term-line-box)";
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--v2-s-1)",
    width: full ? "100%" : undefined,
    minHeight: "var(--v2-touch)",
    padding: "var(--v2-s-3) var(--v2-s-4)",
    background: "transparent",
    color: fg,
    border: "none",
    borderRadius: 0,
    boxShadow: `inset 0 0 0 1px ${line}`,
    fontFamily: "var(--term-mono)",
    fontWeight: 500,
    fontSize: "var(--v2-t-14)",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
    ...style,
  };
  const cls = ["v2-btn-secondary", className].filter(Boolean).join(" ");
  const inner = (
    <>
      <span aria-hidden>[</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--v2-s-2)",
        }}
      >
        {icon && <V2Icon name={icon} style={{ fontSize: "var(--v2-t-16)" }} />}
        {children}
      </span>
      <span aria-hidden>]</span>
    </>
  );

  if (props.as === "a") {
    return (
      <a href={props.href} className={cls} style={baseStyle}>
        {inner}
      </a>
    );
  }
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cls}
      style={baseStyle}
    >
      {inner}
    </button>
  );
}
