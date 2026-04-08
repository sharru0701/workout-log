"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { MINIMAL_COPY_MODE } from "@/lib/ui/minimal-copy";

type AccordionSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  summarySlot?: ReactNode;
  children: ReactNode;
};

export function AccordionSection({
  title,
  description,
  defaultOpen = false,
  summarySlot,
  children,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerId = useId();
  const panelId = useId();

  return (
    <section
    >
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>
          <span>{title}</span>
          {!MINIMAL_COPY_MODE && description ? <span>{description}</span> : null}
        </span>
        <span>
          {summarySlot}
          <span aria-hidden="true" />
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
      >
        <div>{children}</div>
      </div>
    </section>
  );
}
