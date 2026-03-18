import { useId, type HTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";

type DashboardScreenProps = {
  children: ReactNode;
  className?: string;
  wide?: boolean;
};

type DashboardHeroAction = {
  href: string;
  label: ReactNode;
  tone?: "primary" | "secondary";
};

type DashboardHeroMetric = {
  label: ReactNode;
  value: ReactNode;
};

type DashboardHeroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  topSlot?: ReactNode;
  primaryAction?: DashboardHeroAction;
  secondaryAction?: DashboardHeroAction;
  metrics?: DashboardHeroMetric[];
  className?: string;
  tone?: "default" | "accent" | "quiet";
  children?: ReactNode;
};

type DashboardSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  titleId?: string;
  headerTrigger?: boolean;
};

type DashboardActionGridProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
};

type DashboardActionCardProps = {
  href: string;
  title: ReactNode;
  description: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  symbol?: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "neutral";
  className?: string;
};

export type DashboardActionItem = DashboardActionCardProps & {
  key?: string;
};

type DashboardSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  className?: string;
};

type DashboardMetricStripProps = {
  items: DashboardHeroMetric[];
  className?: string;
};

type DashboardActionSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  items: DashboardActionItem[];
  className?: string;
  gridClassName?: string;
  cardClassName?: string;
  ariaLabel?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DashboardScreen({ children, className, wide = false }: DashboardScreenProps) {
  return (
    <div
      className={cx("dashboard-screen", className, wide && "dashboard-screen--wide")}
    >
      {children}
    </div>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  topSlot,
  primaryAction,
  secondaryAction,
  metrics = [],
  className,
  tone = "default",
  children,
}: DashboardHeroProps) {
  return (
    <header className={cx("dashboard-hero", `dashboard-hero--${tone}`, className)}>
      {topSlot ? <div className="dashboard-hero__top-slot">{topSlot}</div> : null}

      {(eyebrow || title || description) && (
        <div className="dashboard-hero__content">
          {eyebrow ? <div className="dashboard-hero__eyebrow">{eyebrow}</div> : null}
          <h1 className="dashboard-hero__title">{title}</h1>
          {description ? <p className="dashboard-hero__description">{description}</p> : null}
        </div>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="dashboard-hero__actions">
          {primaryAction ? (
            <PrimaryButton
              as={Link}
              href={primaryAction.href}
              variant={primaryAction.tone === "secondary" ? "secondary" : "primary"}
              size="lg"
            >
              {primaryAction.label}
            </PrimaryButton>
          ) : null}
          {secondaryAction ? (
            <PrimaryButton
              as={Link}
              href={secondaryAction.href}
              variant={secondaryAction.tone === "secondary" ? "secondary" : "primary"}
              size="lg"
            >
              {secondaryAction.label}
            </PrimaryButton>
          ) : null}
        </div>
      )}

      {metrics.length > 0 ? <DashboardMetricStrip items={metrics} /> : null}
      {children}
    </header>
  );
}

export function DashboardMetricStrip({ items, className }: DashboardMetricStripProps) {
  return (
    <div className={cx("dashboard-metric-strip", className)}>
      {items.map((item, i) => (
        <div className="dashboard-metric-strip__item" key={i}>
          <div className="dashboard-metric-strip__label">{item.label}</div>
          <div className="dashboard-metric-strip__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSection({
  title,
  description,
  children,
  className,
  titleId,
  headerTrigger = false,
}: DashboardSectionProps) {
  return (
    <section className={cx("dashboard-section", className)}>
      <div 
        className="dashboard-section__header"
        data-pull-refresh-trigger={headerTrigger ? "true" : undefined}
      >
        <h2 className="dashboard-section__title" id={titleId}>
          {title}
        </h2>
        {description ? <p className="dashboard-section__description">{description}</p> : null}
      </div>
      <div className="dashboard-section__content">
        {children}
      </div>
    </section>
  );
}

export function DashboardActionGrid({ children, className, ariaLabel, ariaLabelledBy }: DashboardActionGridProps) {
  return (
    <div
      className={cx("dashboard-action-grid", className)}
      role="list"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : ariaLabelledBy}
    >
      {children}
    </div>
  );
}

function toActionItemKey(item: DashboardActionItem, index: number) {
  if (item.key) return item.key;
  const titleKey = typeof item.title === "string" ? item.title : "";
  return `${item.href}:${titleKey}:${index}`;
}

export function DashboardActionCard({
  href,
  title,
  description,
  subtitle,
  meta,
  badge,
  symbol,
  tone = "default",
  className,
}: DashboardActionCardProps) {
  return (
    <Card
      as={Link}
      href={href}
      padding="none"
      interactive
      role="listitem"
      className={cx("dashboard-action-card", `card--${tone}`, className)}
    >
      {symbol ? <div className="dashboard-action-card__symbol">{symbol}</div> : null}
      {badge ? <div className="dashboard-action-card__badge">{badge}</div> : null}
      <div className="dashboard-action-card__title">{title}</div>
      {subtitle ? <div className="dashboard-action-card__subtitle">{subtitle}</div> : null}
      <p className="dashboard-action-card__description">{description}</p>
      {meta ? <div className="dashboard-action-card__meta">{meta}</div> : null}
    </Card>
  );
}

export function DashboardActionSection({
  title,
  description,
  items,
  className,
  gridClassName,
  cardClassName,
  ariaLabel,
}: DashboardActionSectionProps) {
  const titleId = useId();

  return (
    <DashboardSection title={title} description={description} titleId={titleId}>
      <DashboardActionGrid ariaLabel={ariaLabel} ariaLabelledBy={titleId}>
        {items.map((item, index) => (
          <DashboardActionCard key={toActionItemKey(item, index)} {...item} />
        ))}
      </DashboardActionGrid>
    </DashboardSection>
  );
}

export function DashboardSurface({ children, className, ...rest }: DashboardSurfaceProps) {
  return (
    <Card padding="none" {...rest}>
      {children}
    </Card>
  );
}
