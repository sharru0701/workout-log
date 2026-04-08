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
    <div>
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? `Hide ${label}` : `Show ${label}`}
      </button>
      <div id={panelId} role="region" aria-labelledby={triggerId}>
        <div>{children}</div>
      </div>
    </div>
  );
}
