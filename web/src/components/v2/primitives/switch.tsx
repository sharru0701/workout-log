"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";

export type V2SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> & {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
};

export const V2Switch = forwardRef<HTMLInputElement, V2SwitchProps>(
  function V2Switch(
    { checked, onCheckedChange, id, "aria-label": ariaLabel, disabled, ...rest },
    ref,
  ) {
    const reactId = useId();
    const inputId = id ?? reactId;
    return (
      <span className="v2-switch">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          disabled={disabled}
          aria-label={ariaLabel}
          {...rest}
        />
        <span className="v2-switch-track" aria-hidden="true">
          <span className="v2-switch-thumb" />
        </span>
      </span>
    );
  },
);
