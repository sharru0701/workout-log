"use client";

import {
  forwardRef,
  useId,
  type CSSProperties,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import type { V2TextFieldSize } from "./text-field";

const SHELL_PADDING: Record<V2TextFieldSize, string> = {
  md: "var(--v2-s-3) var(--v2-s-4)",
  sm: "var(--v2-s-2) var(--v2-s-3)",
};

const FONT_CLASS: Record<V2TextFieldSize, string> = {
  md: "v2-body",
  sm: "v2-small",
};

export type V2TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: V2TextFieldSize;
  containerClassName?: string;
  containerStyle?: CSSProperties;
};

export const V2Textarea = forwardRef<HTMLTextAreaElement, V2TextareaProps>(
  function V2Textarea(
    {
      label,
      hint,
      error,
      size = "md",
      id,
      required,
      className,
      style,
      containerClassName,
      containerStyle,
      ...textareaProps
    },
    ref,
  ) {
    const reactId = useId();
    const textareaId = id ?? reactId;
    const hintId = hint ? `${textareaId}-hint` : undefined;
    const errorId = error ? `${textareaId}-error` : undefined;
    const describedBy =
      [errorId, hintId].filter(Boolean).join(" ") || undefined;
    const invalid = Boolean(error);

    return (
      <div
        className={["v2-textfield", containerClassName]
          .filter(Boolean)
          .join(" ")}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--v2-s-1)",
          ...containerStyle,
        }}
      >
        {label ? (
          <label htmlFor={textareaId} className="v2-label">
            {label}
            {required ? (
              <span
                aria-hidden
                style={{
                  color: "var(--v2-c-danger)",
                  marginLeft: "var(--v2-s-1)",
                }}
              >
                *
              </span>
            ) : null}
          </label>
        ) : null}
        <div
          className="v2-textfield-shell"
          data-invalid={invalid || undefined}
          style={{
            padding: SHELL_PADDING[size],
            borderRadius: "var(--v2-r-2)",
          }}
        >
          <textarea
            ref={ref}
            id={textareaId}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={[
              "v2-textfield-input",
              "v2-textarea-input",
              FONT_CLASS[size],
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            style={style}
            {...textareaProps}
          />
        </div>
        {error ? (
          <p
            id={errorId}
            className="v2-small"
            role="alert"
            style={{ color: "var(--v2-c-danger)", margin: 0 }}
          >
            {error}
          </p>
        ) : null}
        {hint && !error ? (
          <p
            id={hintId}
            className="v2-small"
            style={{ color: "var(--v2-ink-3)", margin: 0 }}
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
