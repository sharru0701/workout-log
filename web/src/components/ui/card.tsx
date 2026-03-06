import type { ComponentPropsWithoutRef, ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type CardTone = "default" | "subtle" | "accent" | "danger";
type CardPadding = "sm" | "md" | "lg";

type CardProps = {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  tone?: CardTone;
  padding?: CardPadding;
  interactive?: boolean;
} & ComponentPropsWithoutRef<"div">;

type CardSectionProps = {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"div">;

type CardMetaItemProps = {
  label: ReactNode;
  value: ReactNode;
  className?: string;
};

export function Card({
  children,
  className = "",
  elevated = true,
  tone = "default",
  padding = "md",
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        elevated ? "motion-card" : "ui-card",
        "app-card",
        `app-card--${tone}`,
        `app-card--${padding}`,
        interactive && "app-card--interactive",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }: CardSectionProps) {
  return (
    <div className={cx("app-card-header", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", ...props }: CardSectionProps) {
  return (
    <div className={cx("app-card-title", className)} {...props}>
      {children}
    </div>
  );
}

export function CardDescription({ children, className = "", ...props }: CardSectionProps) {
  return (
    <p className={cx("app-card-description", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = "", ...props }: CardSectionProps) {
  return (
    <div className={cx("app-card-content", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", ...props }: CardSectionProps) {
  return (
    <div className={cx("app-card-footer", className)} {...props}>
      {children}
    </div>
  );
}

export function CardActionGroup({ children, className = "", ...props }: CardSectionProps) {
  return (
    <div className={cx("app-card-action-group", className)} {...props}>
      {children}
    </div>
  );
}

export function CardMetaGrid({ children, className = "", ...props }: CardSectionProps) {
  return (
    <div className={cx("app-card-meta-grid", className)} {...props}>
      {children}
    </div>
  );
}

export function CardMetaItem({ label, value, className = "" }: CardMetaItemProps) {
  return (
    <div className={cx("app-card-meta-item", className)}>
      <div className="app-card-meta-label">{label}</div>
      <div className="app-card-meta-value">{value}</div>
    </div>
  );
}
