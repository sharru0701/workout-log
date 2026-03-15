"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "./bottom-sheet";
import { WheelPicker, generateNumberRange, type WheelPickerHandle } from "./wheel-picker";

// ── NumberPickerSheet ────────────────────────────────────────────────────────

export type NumberPickerSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Format function for display text */
  formatValue?: (value: number) => string;
  /** Unit suffix shown next to picker (e.g. "kg", "회") */
  unit?: string;
};

export function NumberPickerSheet({
  open,
  onClose,
  title,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  unit,
}: NumberPickerSheetProps) {
  const pickerRef = useRef<WheelPickerHandle>(null);
  const [draftValue, setDraftValue] = useState(value);

  const values = useMemo(() => generateNumberRange(min, max, step), [min, max, step]);

  // Sync draft value when sheet opens
  useEffect(() => {
    if (open) {
      setDraftValue(value);
    }
  }, [open, value]);

  const handleChange = useCallback((next: number) => {
    setDraftValue(next);
  }, []);

  const handleConfirm = useCallback(() => {
    onChange(draftValue);
    onClose();
  }, [draftValue, onChange, onClose]);

  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onClose}
      closeLabel="닫기"
      panelClassName="number-picker-sheet-panel"
      primaryAction={{
        ariaLabel: "확인",
        onPress: handleConfirm,
      }}
      footer={null}
    >
      <div>
        <div>
          <WheelPicker
            ref={pickerRef}
            values={values}
            value={draftValue}
            onChange={handleChange}
            itemHeight={48}
            visibleCount={7}
            formatValue={formatValue}
          />
          {unit ? <span>{unit}</span> : null}
        </div>
      </div>
    </BottomSheet>
  );
}

// ── NumberPickerField ────────────────────────────────────────────────────────
// A tappable field that displays a value and opens a NumberPickerSheet on tap.

export type NumberPickerFieldProps = {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Format function for display text */
  formatValue?: (value: number) => string;
  /** Unit suffix */
  unit?: string;
  /** Sheet title (defaults to label) */
  sheetTitle?: string;
  /** Additional class on the outer wrapper */
  className?: string;
  /** Variant styling */
  variant?: "default" | "workout-number" | "stepper";
  /** Whether the field is in "complete" state */
  complete?: boolean;
};

export function NumberPickerField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  unit,
  sheetTitle,
  className = "",
  variant = "default",
  complete = false,
}: NumberPickerFieldProps) {
  const [open, setOpen] = useState(false);

  const displayText = formatValue ? formatValue(value) : String(value);

  const fieldClass =
    variant === "workout-number"
      ? "number-picker-field number-picker-field--workout"
      : variant === "stepper"
        ? "number-picker-field number-picker-field--stepper"
        : "number-picker-field";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ? `${label}: ${displayText}` : displayText}
      >
        <span>{displayText}</span>
        {unit ? <span>{unit}</span> : null}
      </button>
      <NumberPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={sheetTitle ?? label ?? "숫자 선택"}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        formatValue={formatValue}
        unit={unit}
      />
    </>
  );
}
