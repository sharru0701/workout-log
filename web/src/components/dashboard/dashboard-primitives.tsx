import { useId, type HTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
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
      className={cx(
        "native-page native-page-enter tab-screen app-dashboard-screen momentum-scroll",
        wide && "tab-screen-wide",
        className,
      )}
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
    <header className={cx("app-dashboard-hero", `app-dashboard-hero--${tone}`, className)}>
      {topSlot ? <div className="app-dashboard-hero-top-slot">{topSlot}</div> : null}

      {(eyebrow || title || description) && (
        <div className="app-dashboard-hero-copy">
          {eyebrow ? <div className="app-dashboard-eyebrow">{eyebrow}</div> : null}
          <h1 className="app-dashboard-title">{title}</h1>
          {description ? <p className="app-dashboard-description">{description}</p> : null}
        </div>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="app-dashboard-hero-actions">
          {primaryAction ? (
            <PrimaryButton
              as={Link}
              href={primaryAction.href}
              variant={primaryAction.tone === "secondary" ? "secondary" : "primary"}
              size="lg"
              className={cx("app-dashboard-hero-action")}
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
              className={cx("app-dashboard-hero-action")}
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
    <div className={cx("app-dashboard-metric-strip", className)}>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="app-dashboard-metric-pill">
          <div className="app-dashboard-metric-label">{item.label}</div>
          <div className="app-dashboard-metric-value">{item.value}</div>
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
    <section className={cx("app-dashboard-section", className)}>
      <div className="app-dashboard-section-head" data-pull-refresh-trigger={headerTrigger ? "true" : undefined}>
        <h2 id={titleId} className="app-dashboard-section-title">
          {title}
        </h2>
        {description ? <p className="app-dashboard-section-description">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardActionGrid({ children, className, ariaLabel, ariaLabelledBy }: DashboardActionGridProps) {
  return (
    <div
      className={cx("app-dashboard-action-grid", className)}
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
    <Link
      href={href}
      className={cx("app-dashboard-action-card", `app-dashboard-action-card--${tone}`, className)}
      role="listitem"
    >
      <div className="app-dashboard-action-top">
        {symbol ? <span className="app-dashboard-action-symbol">{symbol}</span> : null}
        {badge ? <span className="app-dashboard-action-badge">{badge}</span> : null}
      </div>
      <div className="app-dashboard-action-title">{title}</div>
      {subtitle ? <div className="app-dashboard-action-subtitle">{subtitle}</div> : null}
      <p className="app-dashboard-action-description">{description}</p>
      {meta ? <div className="app-dashboard-action-meta">{meta}</div> : null}
    </Link>
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
    <DashboardSection title={title} description={description} className={className} titleId={titleId}>
      <DashboardActionGrid className={gridClassName} ariaLabel={ariaLabel} ariaLabelledBy={titleId}>
        {items.map((item, index) => (
          <DashboardActionCard key={toActionItemKey(item, index)} {...item} className={cardClassName} />
        ))}
      </DashboardActionGrid>
    </DashboardSection>
  );
}

export function DashboardSurface({ children, className, ...rest }: DashboardSurfaceProps) {
  return <div className={cx("app-dashboard-surface", className)} {...rest}>{children}</div>;
}
