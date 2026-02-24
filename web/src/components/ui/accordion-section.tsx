"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

type AccordionSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  summarySlot?: ReactNode;
  surface?: "flat" | "surface";
  children: ReactNode;
};

export function AccordionSection({
  title,
  description,
  defaultOpen = false,
  className = "",
  summarySlot,
  surface = "flat",
  children,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerId = useId();
  const panelId = useId();

  return (
    <section
      className={`ui-accordion ${surface === "surface" ? "ui-accordion-surface" : "ui-accordion-flat"} ${
        isOpen ? "is-open" : ""
      } ${className}`.trim()}
    >
      <button
        id={triggerId}
        type="button"
        className="haptic-tap ui-accordion-trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="ui-accordion-copy">
          <span className="ui-accordion-title">{title}</span>
          {description ? <span className="ui-accordion-description">{description}</span> : null}
        </span>
        <span className="ui-accordion-meta">
          {summarySlot}
          <span className="ui-accordion-chevron" aria-hidden="true" />
        </span>
      </button>

      <div
        id={panelId}
        className="ui-accordion-content"
        role="region"
        aria-labelledby={triggerId}
      >
        <div className="ui-accordion-inner">{children}</div>
      </div>
    </section>
  );
}
