import type { ReactNode } from "react";
import styles from "./screen-title-card.module.css";

type ScreenTitleTone = "neutral" | "blue" | "green" | "orange" | "tint";

type ScreenTitleCardProps = {
  title: ReactNode;
  description?: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  iconSymbol?: string;
  iconTone?: ScreenTitleTone;
  className?: string;
  cardClassName?: string;
  noteClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function iconToneClassName(tone: ScreenTitleTone) {
  return {
    neutral: styles.iconNeutral,
    blue: styles.iconBlue,
    green: styles.iconGreen,
    orange: styles.iconOrange,
    tint: styles.iconTint,
  }[tone];
}

function fallbackSymbolFromTitle(title: ReactNode) {
  if (typeof title !== "string") return undefined;
  const compact = title.replace(/\s+/g, "").trim();
  if (!compact) return undefined;
  return compact.slice(0, 2).toUpperCase();
}

export function ScreenTitleCard({
  title,
  description,
  note,
  actions,
  icon,
  iconSymbol,
  iconTone = "neutral",
  className,
  cardClassName,
  noteClassName,
  titleClassName,
  descriptionClassName,
}: ScreenTitleCardProps) {
  const resolvedSymbol = iconSymbol ?? fallbackSymbolFromTitle(title);
  const hasIcon = Boolean(icon || resolvedSymbol);

  return (
    <div className={cx(styles.shell, className)}>
      <div
        className={cx("tab-screen-header", styles.card, cardClassName)}
        data-has-icon={hasIcon ? "true" : "false"}
        data-has-description={description ? "true" : "false"}
      >
        {icon ? (
          <div className={styles.iconRow}>
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          </div>
        ) : null}
        {!icon && resolvedSymbol ? (
          <div className={styles.iconRow}>
            <span className={cx(styles.icon, iconToneClassName(iconTone))} aria-hidden="true">
              {resolvedSymbol}
            </span>
          </div>
        ) : null}

        <div className={styles.main}>
          <div className={styles.titleRow}>
            <h1 className={cx("tab-screen-title", styles.title, titleClassName)}>{title}</h1>
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </div>
          {description ? (
            <p className={cx("tab-screen-caption", styles.description, descriptionClassName)}>{description}</p>
          ) : null}
        </div>
      </div>

      {note ? <p className={cx(styles.note, noteClassName)}>{note}</p> : null}
    </div>
  );
}
