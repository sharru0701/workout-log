"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type SheetPrimaryAction = {
  ariaLabel: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
};

function CloseIcon() {
  return <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20, fontVariationSettings: "'wght' 500" }}>close</span>;
}

function CheckIcon() {
  return <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20, fontVariationSettings: "'FILL' 0, 'wght' 600" }}>check</span>;
}

export function SheetHeader({
  title,
  description,
  closeLabel,
  onClose,
  onPointerDown,
}: {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <header className="sheet-header" onPointerDown={onPointerDown}>
      <span aria-hidden="true" className="sheet-btn sheet-btn-spacer" />
      <div className="sheet-title">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <button
        type="button"
        className="sheet-btn"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <CloseIcon />
      </button>
    </header>
  );
}

export function SheetActionHeader({
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
  action: SheetPrimaryAction;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <header className="sheet-header" onPointerDown={onPointerDown}>
      <button
        type="button"
        className="sheet-btn"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <CloseIcon />
      </button>
      <div className="sheet-title">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <button
        type="button"
        className="sheet-btn sheet-btn-action"
        onClick={action.onPress}
        aria-label={action.ariaLabel}
        disabled={action.disabled}
      >
        {action.icon ?? <CheckIcon />}
      </button>
    </header>
  );
}
