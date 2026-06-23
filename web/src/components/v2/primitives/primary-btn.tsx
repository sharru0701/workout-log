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

export function V2PrimaryBtn(props: ButtonProps | AnchorProps) {
  const skin = useThemeSkin();
  if (skin === "terminal") return <PrimaryBtnTerminal {...props} />;
  const { children, icon, full = false, style, className } = props;
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--v2-s-2)",
    width: full ? "100%" : undefined,
    minHeight: "var(--v2-s-8)",
    padding: "var(--v2-s-4) var(--v2-s-6)",
    borderRadius: "var(--v2-r-3)",
    background: "var(--v2-accent)",
    color: "var(--v2-ink-on-accent)",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "var(--v2-t-16)",
    letterSpacing: "-0.01em",
    textDecoration: "none",
    boxShadow: "var(--v2-elev-2)",
    transition:
      "transform var(--v2-d-1) var(--v2-e-out), box-shadow var(--v2-d-1) var(--v2-e-out)",
    ...style,
  };
  const cls = [
    "v2-pressable",
    "v2-btn-primary",
    "v2-font-display",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const inner = (
    <>
      {icon && (
        <V2Icon name={icon} style={{ fontSize: "var(--v2-t-h2)" }} />
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
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {inner}
    </button>
  );
}

// ─── terminal(ironlog) 변형 ─────────────────────────────────────────────────
// paper의 amber 솔리드·둥근·그림자 블록 대신 TUI 키처럼: 사각·mono·그림자 없음.
// enabled는 amber 반전(채움), disabled는 outline만. icon 없으면 ▶ 실행 프롬프트.
function PrimaryBtnTerminal(props: ButtonProps | AnchorProps) {
  const { children, icon, full = false, style, className } = props;
  const disabled = props.as !== "a" && Boolean(props.disabled);
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--v2-s-2)",
    width: full ? "100%" : undefined,
    minHeight: "var(--v2-touch)",
    padding: "var(--v2-s-3) var(--v2-s-5)",
    background: disabled ? "transparent" : "var(--term-amber)",
    color: disabled ? "var(--term-ghost)" : "var(--term-bg)",
    border: "none",
    borderRadius: 0,
    boxShadow: disabled ? "inset 0 0 0 1px var(--term-line-box)" : "none",
    fontFamily: "var(--term-mono)",
    fontWeight: 600,
    fontSize: "var(--v2-t-16)",
    letterSpacing: "0.02em",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    ...style,
  };
  const cls = ["v2-btn-primary", className].filter(Boolean).join(" ");
  const inner = (
    <>
      {icon ? (
        <V2Icon name={icon} style={{ fontSize: "var(--v2-t-18)" }} />
      ) : (
        <span aria-hidden>▶</span>
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
      style={baseStyle}
    >
      {inner}
    </button>
  );
}
