"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type BottomSheetPrimaryAction = {
  ariaLabel: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
};

function DefaultCheckIcon() {
  return <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20, fontVariationSettings: "'FILL' 0, 'wght' 600" }}>check</span>;
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
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20, fontVariationSettings: "'wght' 500" }}>close</span>
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
