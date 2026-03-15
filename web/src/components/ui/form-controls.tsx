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
}: {
  kind: "plus" | "minus";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: "24px", height: "24px" }}
    >
      <path d="M5 12h14" />
      {kind === "plus" ? <path d="M12 5v14" /> : null}
    </svg>
  );
}

export const AppTextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { variant?: FormControlVariant }
>(function AppTextInput({ variant = "default", className, ...props }, ref) {
  return <input ref={ref} {...props} />;
});

export const AppTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { variant?: FormControlVariant }
>(function AppTextarea({ variant = "default", className, ...props }, ref) {
  return <textarea ref={ref} {...props} />;
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
      <WrapperTag>
        {label ? <span>{label}</span> : null}
        <span>
          <select
            ref={ref}
            {...props}
            multiple={multiple}
            size={size}
          >
            {children}
          </select>
          <span aria-hidden="true">
            <svg viewBox="0 0 12 16" width="10" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M2 5.5L6 2L10 5.5" />
              <path d="M2 10.5L6 14L10 10.5" />
            </svg>
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

  if (!supportsSingleChevron) {
    return (
      <select ref={ref} {...props} multiple={multiple} size={size}>
        {children}
      </select>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <select ref={ref} {...props} multiple={multiple} size={size}>
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
        <svg
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
          style={{ width: "100%", height: "100%" }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" />
        </svg>
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
