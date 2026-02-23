import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"div">;

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`ui-card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
