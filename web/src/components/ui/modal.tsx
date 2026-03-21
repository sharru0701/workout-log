"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "./bottom-sheet";
import type { BottomSheetPrimaryAction } from "./bottom-sheet-action-header";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  primaryAction?: BottomSheetPrimaryAction | null;
  closeLabel?: string;
  panelClassName?: string;
  className?: string;
};

/**
 * A unified Modal component that wraps BottomSheet with a standardized integrated style.
 * It ensures the "frosted glass" effect and Safari status bar transparency are maintained
 * by avoiding redundant nested containers like Cards.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  primaryAction,
  closeLabel = "닫기",
  panelClassName = "",
  className = "",
}: ModalProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      primaryAction={primaryAction}
      closeLabel={closeLabel}
      panelClassName={panelClassName}
      className={className}
    >
      <div className="modal-content-integrated">
        {children}
      </div>
    </BottomSheet>
  );
}

export type { BottomSheetPrimaryAction as ModalPrimaryAction };
