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
    <header>
      {topSlot ? <div>{topSlot}</div> : null}

      {(eyebrow || title || description) && (
        <div>
          {eyebrow ? <div>{eyebrow}</div> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      )}

      {(primaryAction || secondaryAction) && (
        <div>
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
    <div>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`}>
          <div>{item.label}</div>
          <div>{item.value}</div>
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
    <section>
      <div data-pull-refresh-trigger={headerTrigger ? "true" : undefined}>
        <h2 id={titleId}>
          {title}
        </h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardActionGrid({ children, className, ariaLabel, ariaLabelledBy }: DashboardActionGridProps) {
  return (
    <div
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
    >
      <div>
        {symbol ? <span>{symbol}</span> : null}
        {badge ? <span>{badge}</span> : null}
      </div>
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
      <p>{description}</p>
      {meta ? <div>{meta}</div> : null}
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
