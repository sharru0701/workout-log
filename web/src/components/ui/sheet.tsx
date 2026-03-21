"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { SheetPrimaryAction } from "./sheet-header";
import { SheetHeader, SheetActionHeader } from "./sheet-header";

const CLOSE_DURATION = 320;

type SheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  description?: string;
  className?: string;
  panelClassName?: string;
  closeLabel?: string;
  header?: ReactNode;
  primaryAction?: SheetPrimaryAction | null;
  footer?: ReactNode;
};

export function Sheet({
  open,
  title,
  onClose,
  children,
  description,
  className = "",
  panelClassName = "",
  closeLabel = "닫기",
  header,
  primaryAction = null,
  footer,
}: SheetProps) {
  const sheetId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Open/close the <dialog>
  // `mounted` is in deps so the effect re-runs once the <dialog> element exists.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      // Cancel any pending close
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      isClosingRef.current = false;
      dialog.removeAttribute("data-closing");

      if (!dialog.open) {
        dialog.showModal();
      }

      // Force layout flush, then trigger enter animation
      requestAnimationFrame(() => {
        dialog.setAttribute("data-open", "");
      });
    } else {
      if (dialog.open && !isClosingRef.current) {
        animateClose(dialog);
      }
    }
  }, [open, mounted]);

  const animateClose = useCallback(
    (dialog: HTMLDialogElement) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      dialog.removeAttribute("data-open");
      dialog.setAttribute("data-closing", "");

      closeTimerRef.current = window.setTimeout(() => {
        dialog.close();
        dialog.removeAttribute("data-closing");
        isClosingRef.current = false;
        closeTimerRef.current = null;
      }, CLOSE_DURATION);
    },
    [],
  );

  const handleClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || isClosingRef.current) return;
    animateClose(dialog);
    // Notify parent after animation
    window.setTimeout(onClose, CLOSE_DURATION);
  }, [onClose, animateClose]);

  // Handle <dialog> cancel event (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onCancel = (e: Event) => {
      e.preventDefault();
      handleClose();
    };

    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [handleClose]);

  // Backdrop click (click on dialog but outside panel)
  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        handleClose();
      }
    },
    [handleClose],
  );

  // Scroll lock for iOS Safari
  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const root = document.documentElement;
    const lockCount = Number(body.dataset.sheetLockCount ?? "0");

    if (lockCount === 0) {
      const scrollY = window.scrollY;
      body.dataset.sheetScrollY = String(scrollY);
      root.dataset.sheetOpen = "true";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
    }

    body.dataset.sheetLockCount = String(lockCount + 1);

    return () => {
      const next = Math.max(
        Number(body.dataset.sheetLockCount ?? "1") - 1,
        0,
      );
      body.dataset.sheetLockCount = String(next);
      if (next > 0) return;

      const scrollY = Number(body.dataset.sheetScrollY ?? "0");
      delete body.dataset.sheetLockCount;
      delete body.dataset.sheetScrollY;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      delete root.dataset.sheetOpen;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      dragCleanupRef.current?.();
    },
    [],
  );

  // ── Drag-to-dismiss ──────────────────────────────────────────────
  const clearDragListeners = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }, []);

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, skipInteractiveCheck = false) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!skipInteractiveCheck) {
        const target = event.target as HTMLElement;
        if (target.closest('button, a, [role="button"]')) return;
      }

      const panel = panelRef.current;
      if (!panel) return;

      event.preventDefault();
      clearDragListeners();

      const panelHeight = panel.getBoundingClientRect().height;
      const closeThreshold = Math.min(
        Math.max(panelHeight * 0.22, 88),
        180,
      );
      const pointerId = event.pointerId;
      const startY = event.clientY;
      let dragOffset = 0;
      let lastY = startY;
      let lastTime = event.timeStamp;
      let velocityY = 0;

      panel.setAttribute("data-dragging", "");

      const finish = (close: boolean) => {
        clearDragListeners();
        panel.removeAttribute("data-dragging");

        if (close) {
          panel.style.setProperty("--sheet-drag-offset", `${dragOffset}px`);
          handleClose();
        } else {
          panel.style.setProperty("--sheet-drag-offset", "0px");
        }
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        dragOffset = Math.max(0, moveEvent.clientY - startY);
        panel.style.setProperty(
          "--sheet-drag-offset",
          `${dragOffset}px`,
        );
        if (dragOffset > 0) moveEvent.preventDefault();

        const dt = moveEvent.timeStamp - lastTime;
        if (dt > 0) velocityY = (moveEvent.clientY - lastY) / dt;
        lastY = moveEvent.clientY;
        lastTime = moveEvent.timeStamp;
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        finish(
          dragOffset >= closeThreshold ||
            (velocityY > 0.5 && dragOffset > 20),
        );
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

      window.addEventListener("pointermove", onPointerMove, {
        passive: false,
      });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
    },
    [clearDragListeners, handleClose],
  );

  const hasDescription = Boolean(description);

  if (!mounted) return null;

  return (
    <dialog
      ref={dialogRef}
      id={sheetId}
      className={`sheet ${className}`}
      onClick={handleDialogClick}
    >
      <div
        ref={panelRef}
        className={`sheet-panel ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-drag-handle"
          onPointerDown={(e) => onHandlePointerDown(e, true)}
        >
          <div aria-hidden="true" className="sheet-drag-pill" />
        </div>

        {header ??
          (primaryAction ? (
            <SheetActionHeader
              title={title}
              description={hasDescription ? description : undefined}
              closeLabel={closeLabel}
              onClose={handleClose}
              action={primaryAction}
              onPointerDown={onHandlePointerDown}
            />
          ) : (
            <SheetHeader
              title={title}
              description={hasDescription ? description : undefined}
              closeLabel={closeLabel}
              onClose={handleClose}
              onPointerDown={onHandlePointerDown}
            />
          ))}

        <div className="sheet-body">{children}</div>
      </div>

      {footer ? <div className="sheet-footer">{footer}</div> : null}
    </dialog>
  );
}
