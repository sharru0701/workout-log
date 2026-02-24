import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
} & ComponentPropsWithoutRef<"div">;

export function Card({ children, className = "", elevated = true, ...props }: CardProps) {
  return (
    <div className={`${elevated ? "motion-card" : "ui-card"} rounded-2xl border bg-white ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
