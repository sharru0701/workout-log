import { useState } from "react";
import dynamic from "next/dynamic";

const NumberPickerSheet = dynamic(() => import("@/shared/ui/number-picker-sheet").then(mod => mod.NumberPickerSheet), { ssr: false });

export type InlinePickerRequest = {
  type: "CHANGE_WEIGHT" | "CHANGE_SET_REPS";
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
};

export function WorkoutRecordInlinePicker({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  sheetTitle,
  complete = false,
  failed = false,
  color,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  sheetTitle?: string;
  complete?: boolean;
  failed?: boolean;
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayValue = formatValue ? formatValue(value) : String(value);
  const usesLocalSheet =
    typeof min === "number" &&
    typeof max === "number" &&
    typeof step === "number";

  return (
    <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
      <button
        type="button"
        className="workout-record-picker-btn"
        style={{
          width: "100%",
          padding: "6px 4px",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          backgroundColor: failed
            ? "color-mix(in srgb, var(--color-danger) 25%, var(--color-surface-container-low))"
            : complete
              ? color === "var(--text-metric-reps)"
                ? "var(--color-success-weak)"
                : "color-mix(in srgb, var(--color-success) 18%, var(--color-surface-container-low))"
              : "transparent",
          color: failed
            ? "var(--color-danger-strong)"
            : complete
              ? color === "var(--text-metric-reps)"
                ? "var(--color-success-strong)"
                : "var(--color-text)"
              : color || "var(--color-text-muted)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "22px",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          minHeight: "44px",
        }}
        onClick={() => {
          if (usesLocalSheet) {
            setOpen(true);
            return;
          }
          onChange(value);
        }}
        aria-label={`${label}: ${displayValue}`}
      >
        <span>{displayValue}</span>
      </button>
      {usesLocalSheet ? (
        <NumberPickerSheet
          open={open}
          onClose={() => setOpen(false)}
          title={sheetTitle ?? label}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
          formatValue={formatValue}
        />
      ) : null}
    </div>
  );
}
