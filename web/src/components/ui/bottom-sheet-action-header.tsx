"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type BottomSheetPrimaryAction = {
  ariaLabel: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
};

function DefaultCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function BottomSheetActionHeader({
  title,
  description,
  closeLabel,
  onClose,
  action,
  onPointerDown,
}: {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  action: BottomSheetPrimaryAction;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <header className="mobile-bottom-sheet-header" onPointerDown={onPointerDown}>
      <button
        type="button"
        className="mobile-bottom-sheet-btn"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="mobile-bottom-sheet-title">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <button
        type="button"
        className="mobile-bottom-sheet-btn mobile-bottom-sheet-btn--action"
        onClick={action.onPress}
        aria-label={action.ariaLabel}
        disabled={action.disabled}
      >
        {action.icon ?? <DefaultCheckIcon />}
      </button>
    </header>
  );
}
