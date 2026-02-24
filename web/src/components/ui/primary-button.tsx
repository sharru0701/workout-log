import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: PrimaryButtonProps) {
  const variantClass = variant === "primary" ? "ui-primary-button" : "rounded-xl border px-4 py-2 font-medium";
  return (
    <button type={type} className={`haptic-tap ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
