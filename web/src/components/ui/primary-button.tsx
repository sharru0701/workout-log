import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = {
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ children, className = "", type = "button", ...props }: PrimaryButtonProps) {
  return (
    <button type={type} className={`ui-primary-button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
