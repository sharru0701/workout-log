"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  description?: string;
  className?: string;
  panelClassName?: string;
  closeLabel?: string;
  footer?: ReactNode;
};

export function BottomSheet({
  open,
  title,
  onClose,
  children,
  description,
  className = "",
  panelClassName = "",
  closeLabel = "Close",
  footer,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={`mobile-bottom-sheet ${open ? "is-open pointer-events-auto" : "pointer-events-none"} ${className}`.trim()}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="mobile-bottom-sheet-backdrop"
        onClick={onClose}
      />
      <section
        className={`mobile-bottom-sheet-panel ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mobile-bottom-sheet-handle" aria-hidden="true" />
        <header className="mobile-bottom-sheet-header">
          <div>
            <h2 className="mobile-bottom-sheet-title">{title}</h2>
            {description ? <p className="mobile-bottom-sheet-description">{description}</p> : null}
          </div>
          <button type="button" className="haptic-tap mobile-bottom-sheet-close" onClick={onClose}>
            {closeLabel}
          </button>
        </header>
        <div className="mobile-bottom-sheet-body">{children}</div>
        {footer ? <footer className="mobile-bottom-sheet-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
