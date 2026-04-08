"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { NumberPickerField } from "./number-picker-sheet";

type ClassValue = string | null | undefined | false;

type FormControlVariant = "default" | "compact" | "dense" | "workout" | "workout-number";

function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

function resolveControlClassName(variant: FormControlVariant) {
  if (variant === "workout-number") {
    return "app-form-control workout-set-input workout-set-input-number workout-record-framed-input";
  }
  if (variant === "workout") {
    return "app-form-control workout-set-input workout-set-input-text workout-record-framed-input";
  }
  if (variant === "dense") {
    return "app-form-control rounded-lg border px-2 py-1 text-sm";
  }
  if (variant === "compact") {
    return "app-form-control rounded-lg border px-3 py-2 text-sm";
  }
  return "app-form-control rounded-lg border px-3 py-3 text-base";
}

export function AppPlusMinusIcon({
  kind,
  className = "h-4 w-4",
  size = 24,
}: {
  kind: "plus" | "minus";
  className?: string;
  size?: number | string;
}) {
  const resolvedSize = typeof size === "number" ? `${size}px` : size;
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      style={{ fontSize: resolvedSize, fontVariationSettings: "'FILL' 0, 'wght' 400", lineHeight: 1 }}
    >
      {kind === "plus" ? "add" : "remove"}
    </span>
  );
}

export const AppTextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { variant?: FormControlVariant }
>(function AppTextInput({ variant = "default", className, style, ...props }, ref) {
  return <input ref={ref} className={cx(resolveControlClassName(variant), className)} style={{ width: "100%", padding: "var(--space-sm) var(--space-md)", border: "1px solid var(--color-border)", borderRadius: "8px", font: "var(--font-body)", backgroundColor: "var(--color-surface-container-low)", color: "var(--color-text)", outline: "none", boxSizing: "border-box", ...style }} {...props} />;
});

export const AppTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { variant?: FormControlVariant }
>(function AppTextarea({ variant = "default", className, style, ...props }, ref) {
  return <textarea ref={ref} className={cx(resolveControlClassName(variant), className)} style={{ width: "100%", padding: "var(--space-sm) var(--space-md)", border: "1px solid var(--color-border)", borderRadius: "8px", font: "var(--font-body)", backgroundColor: "var(--color-surface-container-low)", color: "var(--color-text)", outline: "none", boxSizing: "border-box", minHeight: "60px", resize: "vertical", ...style }} {...props} />;
});

export const AppSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    variant?: FormControlVariant;
    wrapperClassName?: string;
    label?: string;
    chrome?: "default" | "row";
  }
>(function AppSelect(
  {
    variant = "default",
    wrapperClassName,
    className,
    children,
    multiple,
    size,
    label,
    chrome = "default",
    ...props
  },
  ref,
) {
  const supportsSingleChevron = !multiple && (typeof size !== "number" || size <= 1);
  const usesRowChrome = supportsSingleChevron && (chrome === "row" || Boolean(label));
  const WrapperTag = label ? "label" : "div";

  // iOS settings-row mode: label on left, value + up-down chevron on right
  if (usesRowChrome) {
    return (
      <WrapperTag
        className={wrapperClassName}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
          width: "100%",
          minHeight: "44px",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          padding: "var(--space-sm) var(--space-md)",
          backgroundColor: "var(--color-surface-container-low)",
          boxSizing: "border-box",
        }}
      >
        {label ? (
          <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)", whiteSpace: "nowrap" }}>
            {label}
          </span>
        ) : null}
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-xs)", minWidth: 0 }}>
          <select
            ref={ref}
            className={className}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--color-text)",
              font: "var(--font-body)",
              outline: "none",
              appearance: "none",
              WebkitAppearance: "none",
              minWidth: 0,
              textAlign: "right",
              textAlignLast: "right",
              paddingRight: "0",
            }}
            {...props}
            multiple={multiple}
            size={size}
          >
            {children}
          </select>
          <span
            aria-hidden="true"
            style={{
              color: "var(--color-text-subtle)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "10px",
              height: "14px",
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'wght' 400", lineHeight: 1 }}>unfold_more</span>
          </span>
        </span>
      </WrapperTag>
    );
  }

  const resolvedClassName = cx(
    resolveControlClassName(variant),
    supportsSingleChevron && "app-form-select",
    className,
  );
  const selectBaseStyle = {
    width: "100%",
    padding: "var(--space-sm) var(--space-md)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    font: "var(--font-body)",
    backgroundColor: "var(--color-surface-container-low)",
    color: "var(--color-text)",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  if (!supportsSingleChevron) {
    return (
      <select ref={ref} className={resolvedClassName} style={selectBaseStyle} {...props} multiple={multiple} size={size}>
        {children}
      </select>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <select
        ref={ref}
        className={resolvedClassName}
        style={{ ...selectBaseStyle, paddingRight: "2.25rem", appearance: "none", WebkitAppearance: "none" }}
        {...props}
        multiple={multiple}
        size={size}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          insetInlineEnd: "0.92rem",
          top: "50%",
          transform: "translateY(-50%)",
          width: "0.82rem",
          height: "0.82rem",
          pointerEvents: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'wght' 400", lineHeight: 1 }}>expand_more</span>
      </span>
    </div>
  );
});

AppTextInput.displayName = "AppTextInput";
AppTextarea.displayName = "AppTextarea";
AppSelect.displayName = "AppSelect";

export function AppNumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  inputMode = "numeric",
  placeholder: _placeholder,
  allowEmpty: _allowEmpty = false,
  displayValue: _displayValue,
  onDisplayValueChange: _onDisplayValueChange,
  complete = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
  allowEmpty?: boolean;
  displayValue?: string;
  onDisplayValueChange?: (next: string) => void;
  complete?: boolean;
}) {
  const stepPrecision = useMemo(() => {
    const raw = String(step);
    if (!raw.includes(".")) return 0;
    return Math.min(4, raw.split(".")[1]?.length ?? 0);
  }, [step]);

  const formatValue = useCallback(
    (v: number) => {
      if (stepPrecision > 0) return v.toFixed(stepPrecision);
      if (inputMode === "decimal") return v.toFixed(1);
      return String(v);
    },
    [stepPrecision, inputMode],
  );

  return (
    <label>
      <span>{label}</span>
      <NumberPickerField
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        formatValue={formatValue}
        label={label}
        variant="stepper"
        complete={complete}
      />
    </label>
  );
}
