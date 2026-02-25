import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";
import Link from "next/link";
import styles from "./settings-list.module.css";
import type { SettingsListTokenOverrides } from "./settings-list.tokens";

type BaseGroupedListProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  tokens?: SettingsListTokenOverrides;
};

type SectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

type SectionFootnoteProps = {
  children: ReactNode;
  className?: string;
};

type RowTone = "neutral" | "success" | "warning" | "critical" | "disabled";
type RowBadgeTone = "neutral" | "accent" | "warning";
type RowIconTone = "neutral" | "tint" | "blue" | "green" | "orange";

type RowBaseProps = {
  rowId?: string;
  label: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  badgeTone?: RowBadgeTone;
  leading?: ReactNode;
  className?: string;
};

type NavigationRowProps = RowBaseProps & {
  href?: string;
  onPress?: () => void;
  value?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  showChevron?: boolean;
};

type ToggleRowProps = RowBaseProps & {
  checked: boolean;
  onCheckedChange: (nextChecked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
};

type ValueRowProps = RowBaseProps & {
  value: ReactNode;
  wrapValue?: boolean;
  href?: string;
  onPress?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  showChevron?: boolean;
};

type InfoRowProps = RowBaseProps & {
  value?: ReactNode;
  tone?: RowTone;
};

type RowIconProps = {
  symbol: ReactNode;
  tone?: RowIconTone;
  label?: string;
};

type SubtitleRowProps = Omit<NavigationRowProps, "subtitle"> & {
  subtitle: ReactNode;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function rowBadgeToneClassName(tone: RowBadgeTone) {
  return {
    neutral: styles.badgeNeutral,
    accent: styles.badgeAccent,
    warning: styles.badgeWarning,
  }[tone];
}

function rowIconToneClassName(tone: RowIconTone) {
  return {
    neutral: styles.rowIconNeutral,
    tint: styles.rowIconTint,
    blue: styles.rowIconBlue,
    green: styles.rowIconGreen,
    orange: styles.rowIconOrange,
  }[tone];
}

function tokensToStyle(tokens?: SettingsListTokenOverrides): CSSProperties | undefined {
  if (!tokens) return undefined;
  const next: CSSProperties = {};
  for (const [name, value] of Object.entries(tokens)) {
    if (!value) continue;
    (next as Record<string, string>)[name] = value;
  }
  return next;
}

function RowContent({
  label,
  subtitle,
  description,
  badge,
  badgeTone = "neutral",
  leading,
  trailing,
}: {
  label: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  badgeTone?: RowBadgeTone;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.body}>
        <span className={styles.label}>{label}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      {trailing || badge ? (
        <span className={styles.trailing}>
          {badge ? <span className={cx(styles.badge, rowBadgeToneClassName(badgeTone))}>{badge}</span> : null}
          {trailing}
        </span>
      ) : null}
    </>
  );
}

export function BaseGroupedList({ children, className, ariaLabel, tokens }: BaseGroupedListProps) {
  return (
    <ul
      className={cx(styles.baseGroupedList, className)}
      aria-label={ariaLabel}
      style={tokensToStyle(tokens)}
      data-settings-grouped-list="true"
    >
      {children}
    </ul>
  );
}

export function SectionHeader({ title, description, className }: SectionHeaderProps) {
  return (
    <header className={cx(styles.sectionHeader, className)} data-settings-section-header="true">
      <h2 className={styles.sectionHeaderTitle}>{title}</h2>
      {description ? <p className={styles.sectionHeaderDescription}>{description}</p> : null}
    </header>
  );
}

export function SectionFootnote({ children, className }: SectionFootnoteProps) {
  return (
    <p className={cx(styles.sectionFootnote, className)} data-settings-footnote="true">
      {children}
    </p>
  );
}

export function RowIcon({ symbol, tone = "neutral", label }: RowIconProps) {
  return (
    <span
      className={cx(styles.rowIcon, rowIconToneClassName(tone))}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {symbol}
    </span>
  );
}

export function NavigationRow({
  rowId,
  label,
  subtitle,
  description,
  badge,
  badgeTone,
  leading,
  className,
  href,
  onPress,
  value,
  disabled = false,
  ariaLabel,
  showChevron = true,
}: NavigationRowProps) {
  const trailing = (
    <>
      {value ? <span className={styles.value}>{value}</span> : null}
      {showChevron ? (
        <span aria-hidden="true" className={styles.chevron}>
          ›
        </span>
      ) : null}
    </>
  );

  if (href && !disabled) {
    return (
      <li id={rowId} className={className} data-settings-row="navigation">
        <Link href={href} aria-label={ariaLabel} className={styles.rowLink} data-settings-touch-target="true">
          <RowContent
            label={label}
            subtitle={subtitle}
            description={description}
            badge={badge}
            badgeTone={badgeTone}
            leading={leading}
            trailing={trailing}
          />
        </Link>
      </li>
    );
  }

  if (!href && !onPress) {
    return (
      <li id={rowId} className={className} data-settings-row="navigation">
        <div className={styles.rowStatic} aria-label={ariaLabel} data-settings-touch-target="true">
          <RowContent
            label={label}
            subtitle={subtitle}
            description={description}
            badge={badge}
            badgeTone={badgeTone}
            leading={leading}
            trailing={trailing}
          />
        </div>
      </li>
    );
  }

  return (
    <li id={rowId} className={className} data-settings-row="navigation">
      <button
        type="button"
        className={styles.rowButton}
        onClick={onPress}
        disabled={disabled}
        aria-label={ariaLabel}
        data-settings-touch-target="true"
      >
        <RowContent
          label={label}
          subtitle={subtitle}
          description={description}
          badge={badge}
          badgeTone={badgeTone}
          leading={leading}
          trailing={trailing}
        />
      </button>
    </li>
  );
}

export function ToggleRow({
  rowId,
  label,
  subtitle,
  description,
  badge,
  badgeTone,
  leading,
  className,
  checked,
  onCheckedChange,
  disabled = false,
  id,
  name,
}: ToggleRowProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const trailing = (
    <span className={styles.toggleContainer}>
      <input
        id={inputId}
        name={name}
        type="checkbox"
        className={styles.toggleInput}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        disabled={disabled}
      />
      <span className={styles.toggleTrack} aria-hidden="true">
        <span className={styles.toggleThumb} />
      </span>
    </span>
  );

  return (
    <li id={rowId} className={className} data-settings-row="toggle">
      <label htmlFor={inputId} className={styles.rowToggleLabel} data-settings-touch-target="true">
        <RowContent
          label={label}
          subtitle={subtitle}
          description={description}
          badge={badge}
          badgeTone={badgeTone}
          leading={leading}
          trailing={trailing}
        />
      </label>
    </li>
  );
}

export function ValueRow({
  rowId,
  label,
  subtitle,
  description,
  badge,
  badgeTone,
  leading,
  className,
  value,
  wrapValue = false,
  href,
  onPress,
  disabled = false,
  ariaLabel,
  showChevron,
}: ValueRowProps) {
  const isInteractive = Boolean((href || onPress) && !disabled);
  const trailing = (
    <>
      <span className={cx(styles.value, wrapValue && styles.valueWrap)}>{value}</span>
      {(showChevron ?? isInteractive) ? (
        <span aria-hidden="true" className={styles.chevron}>
          ›
        </span>
      ) : null}
    </>
  );

  if (href && !disabled) {
    return (
      <li id={rowId} className={className} data-settings-row="value">
        <Link href={href} aria-label={ariaLabel} className={styles.rowLink} data-settings-touch-target="true">
          <RowContent
            label={label}
            subtitle={subtitle}
            description={description}
            badge={badge}
            badgeTone={badgeTone}
            leading={leading}
            trailing={trailing}
          />
        </Link>
      </li>
    );
  }

  if (!href && onPress) {
    return (
      <li id={rowId} className={className} data-settings-row="value">
        <button
          type="button"
          className={styles.rowButton}
          onClick={onPress}
          disabled={disabled}
          aria-label={ariaLabel}
          data-settings-touch-target="true"
        >
          <RowContent
            label={label}
            subtitle={subtitle}
            description={description}
            badge={badge}
            badgeTone={badgeTone}
            leading={leading}
            trailing={trailing}
          />
        </button>
      </li>
    );
  }

  return (
    <li id={rowId} className={className} data-settings-row="value">
      <div className={styles.rowStatic} data-settings-touch-target="true">
        <RowContent
          label={label}
          subtitle={subtitle}
          description={description}
          badge={badge}
          badgeTone={badgeTone}
          leading={leading}
          trailing={trailing}
        />
      </div>
    </li>
  );
}

export function InfoRow({
  rowId,
  label,
  subtitle,
  description,
  badge,
  badgeTone,
  leading,
  className,
  value,
  tone = "neutral",
}: InfoRowProps) {
  const toneClass = {
    neutral: styles.infoNeutral,
    success: styles.infoSuccess,
    warning: styles.infoWarning,
    critical: styles.infoCritical,
    disabled: styles.infoDisabled,
  }[tone];

  return (
    <li id={rowId} className={className} data-settings-row="info">
      <div className={cx(styles.rowStatic, toneClass)} data-settings-touch-target="true">
        <RowContent
          label={label}
          subtitle={subtitle}
          description={description}
          badge={badge}
          badgeTone={badgeTone}
          leading={leading}
          trailing={value ? <span className={styles.value}>{value}</span> : undefined}
        />
      </div>
    </li>
  );
}

export function SubtitleRow(props: SubtitleRowProps) {
  return <NavigationRow {...props} />;
}

export type {
  BaseGroupedListProps,
  SectionHeaderProps,
  SectionFootnoteProps,
  RowIconProps,
  SubtitleRowProps,
  RowIconTone,
  RowBadgeTone,
  NavigationRowProps,
  ToggleRowProps,
  ValueRowProps,
  InfoRowProps,
};
