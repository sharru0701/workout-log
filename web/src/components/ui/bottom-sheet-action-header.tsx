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
    <header>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <span aria-hidden="true" />
      </button>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={action.onPress}
        aria-label={action.ariaLabel}
        disabled={action.disabled}
      >
        {action.icon ?? <DefaultCheckIcon />}
      </button>
    </header>
  );
}
