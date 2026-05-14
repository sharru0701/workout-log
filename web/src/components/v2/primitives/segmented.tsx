"use client";

import type { CSSProperties, ReactNode } from "react";

export type V2SegmentedSize = "md" | "sm";

export type V2SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
};

export type V2SegmentedProps<T extends string> = {
  options: ReadonlyArray<V2SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: V2SegmentedSize;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
};

const TRACK_PADDING: Record<V2SegmentedSize, string> = {
  md: "var(--v2-s-1)",
  sm: "var(--v2-s-1)",
};

const PILL_PADDING: Record<V2SegmentedSize, string> = {
  md: "var(--v2-s-2) var(--v2-s-4)",
  sm: "var(--v2-s-1) var(--v2-s-3)",
};

const PILL_TYPE_CLASS: Record<V2SegmentedSize, string> = {
  md: "v2-body",
  sm: "v2-small",
};

export function V2Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
  style,
}: V2SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={["v2-segmented", className].filter(Boolean).join(" ")}
      style={{
        display: "inline-flex",
        background: "var(--v2-paper-2)",
        borderRadius: "var(--v2-r-pill)",
        padding: TRACK_PADDING[size],
        gap: "var(--v2-s-1)",
        ...style,
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel}
            onClick={() => onChange(opt.value)}
            className={[
              "v2-pressable",
              "v2-segmented-pill",
              PILL_TYPE_CLASS[size],
            ].join(" ")}
            data-selected={selected || undefined}
            style={{
              flex: "1 0 auto",
              minHeight: "var(--v2-s-8)",
              padding: PILL_PADDING[size],
              borderRadius: "var(--v2-r-pill)",
              background: selected ? "var(--v2-paper)" : "transparent",
              color: selected ? "var(--v2-ink)" : "var(--v2-ink-3)",
              boxShadow: selected ? "var(--v2-elev-1)" : "none",
              border: "none",
              cursor: "pointer",
              fontWeight: selected ? 600 : 500,
              transition:
                "background var(--v2-d-1) var(--v2-e-out), color var(--v2-d-1) var(--v2-e-out), box-shadow var(--v2-d-1) var(--v2-e-out)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
