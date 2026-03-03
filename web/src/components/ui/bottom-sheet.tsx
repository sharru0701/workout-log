"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";

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
  const panelRef = useRef<HTMLElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const clearDragState = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    const panel = panelRef.current;
    if (!panel) return;
    panel.classList.remove("is-dragging");
    panel.style.removeProperty("--mobile-bottom-sheet-drag-offset");
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const root = document.documentElement;
    const lockCount = Number(body.dataset.bottomSheetLockCount ?? "0");

    if (lockCount === 0) {
      const scrollY = window.scrollY;
      body.dataset.bottomSheetScrollY = String(scrollY);
      root.dataset.bottomSheetOpen = "true";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      root.style.overflow = "hidden";
    }

    body.dataset.bottomSheetLockCount = String(lockCount + 1);

    return () => {
      const nextLockCount = Math.max(Number(body.dataset.bottomSheetLockCount ?? "1") - 1, 0);
      body.dataset.bottomSheetLockCount = String(nextLockCount);
      if (nextLockCount > 0) return;

      const scrollY = Number(body.dataset.bottomSheetScrollY ?? "0");
      delete body.dataset.bottomSheetLockCount;
      delete body.dataset.bottomSheetScrollY;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      delete root.dataset.bottomSheetOpen;
      root.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    clearDragState();
  }, [open, clearDragState]);

  useEffect(() => () => clearDragState(), [clearDragState]);

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!open || event.button !== 0) return;
      const panel = panelRef.current;
      if (!panel) return;

      clearDragState();

      const closeThresholdPx = 84;
      const pointerId = event.pointerId;
      const startY = event.clientY;
      let dragOffset = 0;

      panel.classList.add("is-dragging");
      panel.style.setProperty("--mobile-bottom-sheet-drag-offset", "0px");

      const finish = (close: boolean) => {
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
        panel.classList.remove("is-dragging");
        if (close) {
          panel.style.removeProperty("--mobile-bottom-sheet-drag-offset");
          onClose();
          return;
        }
        panel.style.setProperty("--mobile-bottom-sheet-drag-offset", "0px");
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        dragOffset = Math.max(0, moveEvent.clientY - startY);
        panel.style.setProperty("--mobile-bottom-sheet-drag-offset", `${dragOffset}px`);
        if (dragOffset > 0) moveEvent.preventDefault();
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        finish(dragOffset >= closeThresholdPx);
      };

      const onPointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) return;
        finish(false);
      };

      dragCleanupRef.current = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
    },
    [open, onClose, clearDragState],
  );

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
        ref={panelRef}
        className={`mobile-bottom-sheet-panel ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mobile-bottom-sheet-handle" aria-hidden="true" onPointerDown={onHandlePointerDown} />
        <header className="mobile-bottom-sheet-header">
          <div>
            <h2 className="mobile-bottom-sheet-title">{title}</h2>
            {description ? <p className="mobile-bottom-sheet-description">{description}</p> : null}
          </div>
          <button type="button" className="haptic-tap mobile-bottom-sheet-close" onClick={onClose} aria-label={closeLabel}>
            <span className="mobile-bottom-sheet-close-icon" aria-hidden="true" />
          </button>
        </header>
        <div className="mobile-bottom-sheet-body">{children}</div>
        {footer ? <footer className="mobile-bottom-sheet-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
