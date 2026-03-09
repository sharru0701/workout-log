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
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
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
  return <input ref={ref} {...props} className={cx(resolveControlClassName(variant), className)} />;
});

export const AppTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { variant?: FormControlVariant }
>(function AppTextarea({ variant = "default", className, ...props }, ref) {
  return <textarea ref={ref} {...props} className={cx(resolveControlClassName(variant), className)} />;
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
      <WrapperTag className={cx("app-select-row", !label && "app-select-row--standalone", wrapperClassName)}>
        {label ? <span className="app-select-row-label">{label}</span> : null}
        <span className="app-select-row-right">
          <select
            ref={ref}
            {...props}
            multiple={multiple}
            size={size}
            className={cx("app-select-row-native", !label && "app-select-row-native--standalone", className)}
          >
            {children}
          </select>
          <span className="app-select-row-chevron" aria-hidden="true">
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
      <select ref={ref} {...props} multiple={multiple} size={size} className={resolvedClassName}>
        {children}
      </select>
    );
  }

  return (
    <div className={cx("app-form-select-shell", wrapperClassName)} style={{ position: "relative", width: "100%" }}>
      <select ref={ref} {...props} multiple={multiple} size={size} className={resolvedClassName}>
        {children}
      </select>
      <span
        className="app-form-select-chevron"
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
  placeholder,
  allowEmpty = false,
  displayValue,
  onDisplayValueChange,
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
  const [draftValue, setDraftValue] = useState(() => String(value));
  const [isEditing, setIsEditing] = useState(false);
  const usesExternalDraftValue = typeof displayValue === "string" && typeof onDisplayValueChange === "function";
  const resolvedDraftValue = usesExternalDraftValue ? displayValue : draftValue;

  const stepPrecision = useMemo(() => {
    const raw = String(step);
    if (!raw.includes(".")) return 0;
    return Math.min(4, raw.split(".")[1]?.length ?? 0);
  }, [step]);

  useEffect(() => {
    if (usesExternalDraftValue) return;
    if (isEditing) return;
    setDraftValue(String(value));
  }, [isEditing, usesExternalDraftValue, value]);

  const syncDraftValue = useCallback(
    (next: string) => {
      if (usesExternalDraftValue) {
        onDisplayValueChange?.(next);
        return;
      }
      setDraftValue(next);
    },
    [onDisplayValueChange, usesExternalDraftValue],
  );

  const clampValue = useCallback(
    (next: number) => {
      const normalized = inputMode === "numeric" ? Math.round(next) : next;
      const clamped = Math.min(max, Math.max(min, normalized));
      return Number(clamped.toFixed(stepPrecision));
    },
    [inputMode, max, min, stepPrecision],
  );

  const commitDraftValue = useCallback(
    (rawValue: string) => {
      const normalized = rawValue.trim();
      if (!normalized) {
        if (allowEmpty) {
          syncDraftValue("");
          return;
        }
        syncDraftValue(String(value));
        return;
      }
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) {
        if (allowEmpty) {
          syncDraftValue("");
          return;
        }
        syncDraftValue(String(value));
        return;
      }
      const clamped = clampValue(parsed);
      onChange(clamped);
      syncDraftValue(String(clamped));
    },
    [allowEmpty, clampValue, onChange, syncDraftValue, value],
  );

  const handleStepDown = useCallback(() => {
    const next = clampValue(value - step);
    setIsEditing(false);
    syncDraftValue(String(next));
    onChange(next);
  }, [clampValue, onChange, step, syncDraftValue, value]);

  const handleStepUp = useCallback(() => {
    const next = clampValue(value + step);
    setIsEditing(false);
    syncDraftValue(String(next));
    onChange(next);
  }, [clampValue, onChange, step, syncDraftValue, value]);

  return (
    <label className={cx("workout-stepper", complete && "is-complete")}>
      <span className="ui-card-label">{label}</span>
      <div className="workout-stepper-control">
        <button
          type="button"
          className="haptic-tap workout-stepper-button"
          onClick={handleStepDown}
          aria-label={`${label} 줄이기`}
        >
          <AppPlusMinusIcon kind="minus" />
        </button>
        <input
          className="workout-stepper-input"
          type="number"
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          value={resolvedDraftValue}
          placeholder={placeholder}
          onFocus={() => setIsEditing(true)}
          onBlur={() => {
            setIsEditing(false);
            commitDraftValue(resolvedDraftValue);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commitDraftValue(resolvedDraftValue);
            event.currentTarget.blur();
          }}
          onChange={(event) => {
            const nextRaw = event.target.value;
            syncDraftValue(nextRaw);
            const normalized = nextRaw.trim();
            if (!normalized) {
              if (!allowEmpty) return;
              return;
            }
            const parsed = Number(normalized);
            if (!Number.isFinite(parsed)) return;
            onChange(clampValue(parsed));
          }}
        />
        <button
          type="button"
          className="haptic-tap workout-stepper-button"
          onClick={handleStepUp}
          aria-label={`${label} 늘리기`}
        >
          <AppPlusMinusIcon kind="plus" />
        </button>
      </div>
    </label>
  );
}
