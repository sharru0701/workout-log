"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MINIMAL_COPY_MODE } from "@/lib/ui/minimal-copy";
import { BottomSheetActionHeader, type BottomSheetPrimaryAction } from "./bottom-sheet-action-header";

const SHEET_STACK_EVENT = "mobile-bottom-sheet-stack-change";
const SHEET_STACK_DATA_KEY = "bottomSheetStack";
const BOTTOM_SHEET_BG_COLOR = "var(--color-bg)"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
const BOTTOM_SHEET_BODY_BG_DATA_KEY = "bottomSheetPrevBodyBg"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
const BOTTOM_SHEET_HTML_BG_DATA_KEY = "bottomSheetPrevHtmlBg"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응

function readSheetStack(body: HTMLElement) {
  const raw = body.dataset[SHEET_STACK_DATA_KEY];
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
      return parsed;
    }
  } catch {
    return [] as string[];
  }

  return [] as string[];
}

function writeSheetStack(body: HTMLElement, stack: string[]) {
  if (stack.length > 0) {
    body.dataset[SHEET_STACK_DATA_KEY] = JSON.stringify(stack);
  } else {
    delete body.dataset[SHEET_STACK_DATA_KEY];
  }

  window.dispatchEvent(new Event(SHEET_STACK_EVENT));
}

function upsertSheetId(body: HTMLElement, id: string) {
  const nextStack = readSheetStack(body).filter((item) => item !== id);
  nextStack.push(id);
  writeSheetStack(body, nextStack);
}

function removeSheetId(body: HTMLElement, id: string) {
  const currentStack = readSheetStack(body);
  const nextStack = currentStack.filter((item) => item !== id);
  if (nextStack.length === currentStack.length) return;
  writeSheetStack(body, nextStack);
}

function topSheetId(body: HTMLElement) {
  const stack = readSheetStack(body);
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function getActiveHtmlElement() {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  description?: string;
  className?: string;
  panelClassName?: string;
  closeLabel?: string;
  header?: ReactNode;
  primaryAction?: BottomSheetPrimaryAction | null;
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
  header,
  primaryAction = null,
  footer,
}: BottomSheetProps) {
  const sheetId = useId();
  const [mounted, setMounted] = useState(false);
  const [isTopSheet, setIsTopSheet] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const closeAnimationTimerRef = useRef<number | null>(null);
  const openAnimationFrameRef = useRef<number | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const closeAnimationMs = 400;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (openAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(openAnimationFrameRef.current);
      openAnimationFrameRef.current = null;
    }

    if (!open) {
      return;
    }

    openAnimationFrameRef.current = window.requestAnimationFrame(() => {
      openAnimationFrameRef.current = window.requestAnimationFrame(() => {
        openAnimationFrameRef.current = null;
      });
    });

    return () => {
      if (openAnimationFrameRef.current === null) return;
      window.cancelAnimationFrame(openAnimationFrameRef.current);
      openAnimationFrameRef.current = null;
    };
  }, [mounted, open]);

  const syncTopSheetState = useCallback(() => {
    if (!open) {
      setIsTopSheet(false);
      return;
    }
    setIsTopSheet(topSheetId(document.body) === sheetId);
  }, [open, sheetId]);

  useEffect(() => {
    if (!open) {
      removeSheetId(document.body, sheetId);
      syncTopSheetState();
      return;
    }

    upsertSheetId(document.body, sheetId);
    syncTopSheetState();
    window.addEventListener(SHEET_STACK_EVENT, syncTopSheetState);

    return () => {
      window.removeEventListener(SHEET_STACK_EVENT, syncTopSheetState);
      removeSheetId(document.body, sheetId);
    };
  }, [open, sheetId, syncTopSheetState]);

  const isInteractiveSheet = open && isTopSheet;
  const hasDescription = !MINIMAL_COPY_MODE && Boolean(description);

  useLayoutEffect(() => {
    if (isInteractiveSheet) return;

    const sheet = sheetRef.current;
    const activeElement = getActiveHtmlElement();
    if (sheet && activeElement && sheet.contains(activeElement)) {
      activeElement.blur();
    }
  }, [isInteractiveSheet]);

  useLayoutEffect(() => {
    if (!isInteractiveSheet) return;

    const sheet = sheetRef.current;
    const panel = panelRef.current;
    if (!sheet || !panel) return;

    const activeElement = getActiveHtmlElement();
    if (activeElement && !sheet.contains(activeElement)) {
      restoreFocusRef.current = activeElement;
    }
    if (activeElement && sheet.contains(activeElement)) return;

    const focusFrame = window.requestAnimationFrame(() => {
      const currentActiveElement = getActiveHtmlElement();
      if (currentActiveElement && sheet.contains(currentActiveElement)) return;
      panel.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [isInteractiveSheet]);

  useEffect(() => {
    if (open) return;

    const restoreTarget = restoreFocusRef.current;
    if (!restoreTarget?.isConnected) return;

    const focusFrame = window.requestAnimationFrame(() => {
      if (!restoreTarget.isConnected) return;

      const ownerSheet = restoreTarget.closest(".mobile-bottom-sheet");
      if (ownerSheet instanceof HTMLElement) {
        if (ownerSheet.hasAttribute("inert")) return;
      } else if (topSheetId(document.body) !== null) {
        return;
      }

      restoreTarget.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [open]);

  const clearDragListeners = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }, []);

  const clearDragVisual = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.classList.remove("is-dragging");
    panel.classList.remove("is-closing");
    panel.style.removeProperty("--mobile-bottom-sheet-drag-offset");
  }, []);

  const clearDragState = useCallback(() => {
    clearDragListeners();
    clearDragVisual();
    if (closeAnimationTimerRef.current !== null) {
      window.clearTimeout(closeAnimationTimerRef.current);
      closeAnimationTimerRef.current = null;
    }
  }, [clearDragListeners, clearDragVisual]);

  // 닫기 애니메이션: is-closing 클래스로 패널 슬라이드 → 애니메이션 후 onClose() 호출
  const handleClose = useCallback(() => {
    if (!isInteractiveSheet) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (panel.classList.contains("is-closing")) return;

    panel.classList.add("is-closing");
    window.setTimeout(() => {
      onClose();
    }, closeAnimationMs);
  }, [isInteractiveSheet, onClose, closeAnimationMs]);

  useEffect(() => {
    if (!isInteractiveSheet) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isInteractiveSheet, handleClose]);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const root = document.documentElement;
    const lockCount = Number(body.dataset.bottomSheetLockCount ?? "0");

    if (lockCount === 0) {
      const scrollY = window.scrollY;
      body.dataset.bottomSheetScrollY = String(scrollY);
      body.dataset[BOTTOM_SHEET_BODY_BG_DATA_KEY] = body.style.backgroundColor; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      root.dataset[BOTTOM_SHEET_HTML_BG_DATA_KEY] = root.style.backgroundColor; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      root.dataset.bottomSheetOpen = "true"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.backgroundColor = BOTTOM_SHEET_BG_COLOR; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      root.style.backgroundColor = BOTTOM_SHEET_BG_COLOR; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.position = "fixed"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.top = `-${scrollY}px`; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.left = "0"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.right = "0"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.width = "100%"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.overflow = "hidden"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      root.style.overflow = "hidden"; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
    }

    body.dataset.bottomSheetLockCount = String(lockCount + 1);

    return () => {
      const nextLockCount = Math.max(Number(body.dataset.bottomSheetLockCount ?? "1") - 1, 0);
      body.dataset.bottomSheetLockCount = String(nextLockCount);
      if (nextLockCount > 0) return;

      const scrollY = Number(body.dataset.bottomSheetScrollY ?? "0");
      const prevBodyBackgroundColor = body.dataset[BOTTOM_SHEET_BODY_BG_DATA_KEY] ?? ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      const prevHtmlBackgroundColor = root.dataset[BOTTOM_SHEET_HTML_BG_DATA_KEY] ?? ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      delete body.dataset.bottomSheetLockCount; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      delete body.dataset.bottomSheetScrollY; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      delete body.dataset[BOTTOM_SHEET_BODY_BG_DATA_KEY]; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      delete root.dataset[BOTTOM_SHEET_HTML_BG_DATA_KEY]; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.position = ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.top = ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.left = ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.right = ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.width = ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.overflow = ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      body.style.backgroundColor = prevBodyBackgroundColor; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      delete root.dataset.bottomSheetOpen; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      root.style.overflow = ""; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      root.style.backgroundColor = prevHtmlBackgroundColor; // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
      window.scrollTo(0, scrollY); // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      if (closeAnimationTimerRef.current !== null) {
        window.clearTimeout(closeAnimationTimerRef.current);
        closeAnimationTimerRef.current = null;
      }
      clearDragVisual();
      return;
    }

    clearDragListeners();
    if (closeAnimationTimerRef.current !== null) window.clearTimeout(closeAnimationTimerRef.current);
    closeAnimationTimerRef.current = window.setTimeout(() => {
      clearDragVisual();
      closeAnimationTimerRef.current = null;
    }, closeAnimationMs);

    return () => {
      if (closeAnimationTimerRef.current === null) return;
      window.clearTimeout(closeAnimationTimerRef.current);
      closeAnimationTimerRef.current = null;
    };
  }, [open, clearDragListeners, clearDragVisual]);

  useEffect(() => () => clearDragState(), [clearDragState]);

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, skipInteractiveCheck = false) => {
      if (!isInteractiveSheet) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      // 헤더 내 버튼/링크 클릭 시 드래그 무시
      if (!skipInteractiveCheck) {
        const target = event.target as HTMLElement;
        if (target.closest('button, a, [role="button"]')) return;
      }
      const panel = panelRef.current;
      if (!panel) return;

      event.preventDefault();
      clearDragState();

      const panelHeight = panel.getBoundingClientRect().height;
      const closeThresholdPx = Math.min(Math.max(panelHeight * 0.22, 88), 180);
      const pointerId = event.pointerId;
      const startY = event.clientY;
      let dragOffset = 0;
      let lastY = startY;
      let lastTime = event.timeStamp;
      let velocityY = 0;

      panel.classList.add("is-dragging");
      panel.style.setProperty("--mobile-bottom-sheet-drag-offset", "0px");

      const finish = (close: boolean) => {
        clearDragListeners();
        panel.classList.remove("is-dragging");
        if (close) {
          // 드래그 놓는 위치에서 아래로 슬라이드 후 닫기
          panel.classList.add("is-closing");
          window.setTimeout(() => {
            onClose();
          }, closeAnimationMs);
          return;
        }
        panel.style.setProperty("--mobile-bottom-sheet-drag-offset", "0px");
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        dragOffset = Math.max(0, moveEvent.clientY - startY);
        panel.style.setProperty("--mobile-bottom-sheet-drag-offset", `${dragOffset}px`);
        if (dragOffset > 0) moveEvent.preventDefault();

        // 속도 추적 (px/ms)
        const dt = moveEvent.timeStamp - lastTime;
        if (dt > 0) velocityY = (moveEvent.clientY - lastY) / dt;
        lastY = moveEvent.clientY;
        lastTime = moveEvent.timeStamp;
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        // 임계값 초과 OR 빠른 플릭(0.5px/ms 이상 + 20px 이상 드래그)으로 닫기
        finish(dragOffset >= closeThresholdPx || (velocityY > 0.5 && dragOffset > 20));
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
    [isInteractiveSheet, onClose, clearDragState, clearDragListeners],
  );

  const sheetElement = (
    <div
      ref={sheetRef}
      inert={!isInteractiveSheet}
      className={`mobile-bottom-sheet ${className}`}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="mobile-bottom-sheet-overlay"
        onClick={() => {
          if (!isInteractiveSheet) return;
          handleClose();
        }}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`mobile-bottom-sheet-panel ${panelClassName}`}
      >
        <div
          className="mobile-bottom-sheet-drag-handle"
          onPointerDown={(e) => onHandlePointerDown(e, true)}
        >
          <div aria-hidden="true" className="mobile-bottom-sheet-drag-handle-pill" />
        </div>
        {header ?? (primaryAction ? (
          <BottomSheetActionHeader
            title={title}
            description={hasDescription ? description : undefined}
            closeLabel={closeLabel}
            onClose={handleClose}
            action={primaryAction}
            onPointerDown={onHandlePointerDown}
          />
        ) : (
          <header
            className="mobile-bottom-sheet-header"
            onPointerDown={onHandlePointerDown}
          >
            <span aria-hidden="true" className="mobile-bottom-sheet-btn mobile-bottom-sheet-btn-spacer" />
            <div className="mobile-bottom-sheet-title">
              <h2>{title}</h2>
              {hasDescription ? <p>{description}</p> : null}
            </div>
            <button type="button" className="mobile-bottom-sheet-btn" onClick={handleClose} aria-label={closeLabel}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>
        ))}
        <div className="mobile-bottom-sheet-content">{children}</div>
        {footer ? <footer className="mobile-bottom-sheet-footer">{footer}</footer> : null}
      </section>
    </div>
  );

  if (!mounted) return null;

  return createPortal(sheetElement, document.body);
}
