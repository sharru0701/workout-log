"use client";

import type { ReactNode } from "react";

export type V2ChipTone =
  | "neutral"
  | "accent"
  | "weight"
  | "reps"
  | "volume"
  | "onerm"
  | "pr"
  | "success"
  | "warning"
  | "danger"
  | "info";

const CHIP_TONES: Record<V2ChipTone, { fg: string; bg: string }> = {
  neutral: { fg: "var(--v2-ink-2)", bg: "var(--v2-paper-2)" },
  accent: { fg: "var(--v2-accent-ink)", bg: "var(--v2-accent-weak)" },
  weight: {
    fg: "var(--v2-c-weight)",
    bg: "color-mix(in srgb, var(--v2-c-weight) 12%, var(--v2-paper))",
  },
  reps: {
    fg: "var(--v2-c-reps)",
    bg: "color-mix(in srgb, var(--v2-c-reps) 12%, var(--v2-paper))",
  },
  volume: {
    fg: "var(--v2-c-volume)",
    bg: "color-mix(in srgb, var(--v2-c-volume) 12%, var(--v2-paper))",
  },
  onerm: {
    fg: "var(--v2-c-onerm)",
    bg: "color-mix(in srgb, var(--v2-c-onerm) 12%, var(--v2-paper))",
  },
  pr: {
    fg: "var(--v2-c-pr)",
    bg: "color-mix(in srgb, var(--v2-c-pr) 14%, var(--v2-paper))",
  },
  success: {
    fg: "var(--v2-c-success)",
    bg: "color-mix(in srgb, var(--v2-c-success) 12%, var(--v2-paper))",
  },
  warning: {
    fg: "var(--v2-c-warning)",
    bg: "color-mix(in srgb, var(--v2-c-warning) 14%, var(--v2-paper))",
  },
  danger: {
    fg: "var(--v2-c-danger)",
    bg: "color-mix(in srgb, var(--v2-c-danger) 12%, var(--v2-paper))",
  },
  info: {
    fg: "var(--v2-c-info)",
    bg: "color-mix(in srgb, var(--v2-c-info) 12%, var(--v2-paper))",
  },
};

export function V2Chip({
  tone = "neutral",
  solid = false,
  icon,
  children,
}: {
  tone?: V2ChipTone;
  solid?: boolean;
  icon?: string;
  children: ReactNode;
}) {
  const t = CHIP_TONES[tone];
  return (
    <span
      className="v2-chip v2-font-display"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--v2-s-1)",
        padding: "var(--v2-s-1) var(--v2-s-3)",
        borderRadius: "var(--v2-r-pill)",
        fontSize: "var(--v2-t-label)",
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: solid ? t.fg : t.bg,
        color: solid ? "var(--v2-ink-on-accent)" : t.fg,
      }}
    >
      {icon && (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "var(--v2-t-small)" }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
