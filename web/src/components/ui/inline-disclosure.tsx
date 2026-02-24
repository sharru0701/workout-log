"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

type InlineDisclosureProps = {
  label?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

export function InlineDisclosure({
  label = "Details",
  defaultOpen = false,
  className = "",
  children,
}: InlineDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerId = useId();
  const panelId = useId();

  return (
    <div className={`ui-inline-disclosure ${isOpen ? "is-open" : ""} ${className}`.trim()}>
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="haptic-tap ui-inline-disclosure-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? `Hide ${label}` : `Show ${label}`}
      </button>
      <div id={panelId} className="ui-inline-disclosure-content" role="region" aria-labelledby={triggerId}>
        <div className="ui-inline-disclosure-inner">{children}</div>
      </div>
    </div>
  );
}
