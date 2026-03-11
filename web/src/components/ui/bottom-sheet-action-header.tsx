"use client";

import type { ReactNode } from "react";

export type BottomSheetPrimaryAction = {
  ariaLabel: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
};

function DefaultCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M5 12.5 10 17l9-11" />
    </svg>
  );
}

export function BottomSheetActionHeader({
  title,
  description,
  closeLabel,
  onClose,
  action,
}: {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  action: BottomSheetPrimaryAction;
}) {
  return (
    <header className="mobile-bottom-sheet-header sheet-action-header">
      <button
        type="button"
        className="haptic-tap mobile-bottom-sheet-close sheet-action-icon-button"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <span className="mobile-bottom-sheet-close-icon" aria-hidden="true" />
      </button>
      <div className="sheet-action-header-copy">
        <h2 className="mobile-bottom-sheet-title sheet-action-title">{title}</h2>
        {description ? <p className="mobile-bottom-sheet-description sheet-action-description">{description}</p> : null}
      </div>
      <button
        type="button"
        className="haptic-tap sheet-action-icon-button sheet-action-confirm-button"
        onClick={action.onPress}
        aria-label={action.ariaLabel}
        disabled={action.disabled}
      >
        {action.icon ?? <DefaultCheckIcon />}
      </button>
    </header>
  );
}
