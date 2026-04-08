"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { Sheet } from "./sheet";
import type { SheetPrimaryAction } from "./sheet-header";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  primaryAction?: SheetPrimaryAction | null;
  closeLabel?: string;
  panelClassName?: string;
  className?: string;
  header?: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  primaryAction,
  closeLabel,
  panelClassName = "",
  className = "",
  header,
}: ModalProps) {
  const { locale } = useLocale();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      primaryAction={primaryAction}
      closeLabel={closeLabel ?? (locale === "ko" ? "닫기" : "Close")}
      panelClassName={panelClassName}
      className={className}
      header={header}
    >
      <div className="modal-content-integrated">{children}</div>
    </Sheet>
  );
}

export type { SheetPrimaryAction as ModalPrimaryAction };
