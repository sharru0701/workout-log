import { forwardRef, memo, type ReactNode } from "react";

export type AppPlusMinusIconProps = {
  kind: "plus" | "minus";
  size?: number;
  color?: string;
  className?: string;
};

export const AppPlusMinusIcon = memo(function AppPlusMinusIcon({
  kind,
  size = 24,
  color = "currentColor",
}: AppPlusMinusIconProps) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        color,
        fontVariationSettings: "'wght' 500",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden="true"
    >
      {kind}
    </span>
  );
});

export type AppTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: "default" | "workout";
};

export const AppTextarea = memo(function AppTextarea({
  variant = "default",
  style,
  ...props
}: AppTextareaProps) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: "12px",
        border: variant === "workout" ? "none" : "1px solid var(--color-border)",
        background: variant === "workout" ? "var(--color-surface-container)" : "var(--color-surface)",
        color: "var(--color-text)",
        fontFamily: "var(--font-body-family)",
        fontSize: "14px",
        lineHeight: "1.5",
        resize: "none",
        minHeight: "80px",
        ...style,
      }}
    />
  );
});

export type StepperControlProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  label: string;
  variant?: "default" | "stepper";
  complete?: boolean;
};

export const StepperControl = memo(function StepperControl({
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  label,
  variant = "default",
  complete = false,
}: StepperControlProps) {
  const displayValue = formatValue ? formatValue(value) : String(value);

  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  return (
    <div className={`stepper-control stepper-control--${variant} ${complete ? "stepper-control--complete" : ""}`}>
      <button
        type="button"
        className="stepper-control__btn"
        onClick={handleDecrement}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        <AppPlusMinusIcon kind="minus" size={18} />
      </button>
      <div className="stepper-control__value" aria-label={`${label}: ${displayValue}`}>
        {displayValue}
      </div>
      <button
        type="button"
        className="stepper-control__btn"
        onClick={handleIncrement}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        <AppPlusMinusIcon kind="plus" size={18} />
      </button>
    </div>
  );
});

export type AppTextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "workout" | "compact" | "dense";
};

// forwardRef: ref를 직접 input 엘리먼트로 전달 (프로그래매틱 포커스 등 지원)
export const AppTextInput = forwardRef<HTMLInputElement, AppTextInputProps>(
  function AppTextInput({ variant = "default", style, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "12px",
          border: variant === "workout" ? "none" : "1px solid var(--color-border)",
          background: variant === "workout" ? "var(--color-surface-container)" : "var(--color-surface)",
          color: "var(--color-text)",
          fontFamily: "var(--font-body-family)",
          fontSize: "14px",
          lineHeight: "1.5",
          ...style,
        }}
      />
    );
  },
);

export type AppSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  variant?: "default" | "compact";
  wrapperClassName?: string;
  children?: ReactNode;
};

export const AppSelect = memo(function AppSelect({
  label: _label,
  variant: _variant,
  wrapperClassName,
  style,
  children,
  ...props
}: AppSelectProps) {
  const select = (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "10px 16px",
        borderRadius: "12px",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        fontFamily: "var(--font-body-family)",
        fontSize: "14px",
        lineHeight: "1.5",
        appearance: "auto",
        ...style,
      }}
    >
      {children}
    </select>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{select}</div>;
  }
  return select;
});

export type AppNumberStepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  formatValue?: (value: number) => string;
  inputMode?: React.HTMLAttributes<HTMLElement>["inputMode"];
  complete?: boolean;
};

export const AppNumberStepper = memo(function AppNumberStepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  complete,
}: AppNumberStepperProps) {
  return (
    <AppStepperField
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      formatValue={formatValue}
      complete={complete}
    />
  );
});

export type AppStepperFieldProps = StepperControlProps;

export function AppStepperField({
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  label,
  complete,
}: AppStepperFieldProps) {
  return (
    <label className="app-stepper-field">
      <span className="app-stepper-field__label">{label}</span>
      <StepperControl
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
