import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type CardTone = "default" | "subtle" | "accent" | "danger";
type CardPadding = "none" | "sm" | "md" | "lg";

type CardOwnProps = {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  tone?: CardTone;
  padding?: CardPadding;
  interactive?: boolean;
};

type CardProps<T extends ElementType = "div"> = CardOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps | "as">;

type CardSectionProps = {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"div">;

type CardMetaItemProps = {
  label: ReactNode;
  value: ReactNode;
  className?: string;
};

export function Card<T extends ElementType = "div">({
  as,
  children,
  className = "",
  elevated = true,
  tone = "default",
  padding = "md",
  interactive = false,
  ...props
}: CardProps<T>) {
  const Component = (as ?? "div") as ElementType;

  return (
    <Component
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
    </Component>
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
