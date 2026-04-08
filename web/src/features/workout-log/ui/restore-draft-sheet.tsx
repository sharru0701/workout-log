"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PrimaryButton } from "@/components/ui/primary-button";
import type { PendingRestorePrompt } from "@/features/workout-log/model/editor-actions";

type RestoreDraftSheetProps = {
  request: PendingRestorePrompt | null;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onResolve: (keep: boolean) => void;
};

export const RestoreDraftSheet = memo(function RestoreDraftSheet({
  request,
  title,
  message,
  confirmText,
  cancelText,
  onResolve,
}: RestoreDraftSheetProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (request) {
      closingRef.current = false;
      setOpen(true);
      return;
    }
    setOpen(false);
  }, [request]);

  const beginClose = useCallback((keep: boolean) => {
    if (!request || closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      closingRef.current = false;
      onResolve(keep);
    }, 420);
  }, [onResolve, request]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open || !request) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        beginClose(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beginClose, open, request]);

  useEffect(() => {
    if (!open || !request) return;

    const panel = panelRef.current;
    if (!panel) return;

    const stopBackgroundScroll = (event: TouchEvent | WheelEvent) => {
      const target = event.target;
      if (target instanceof Node && panel.contains(target)) {
        return;
      }
      event.preventDefault();
    };

    document.addEventListener("touchmove", stopBackgroundScroll, { capture: true, passive: false });
    document.addEventListener("wheel", stopBackgroundScroll, { capture: true, passive: false });

    return () => {
      document.removeEventListener("touchmove", stopBackgroundScroll, true);
      document.removeEventListener("wheel", stopBackgroundScroll, true);
    };
  }, [open, request]);

  const onHandlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!open || !request || closingRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const panel = panelRef.current;
    if (!panel) return;

    event.preventDefault();
    dragCleanupRef.current?.();

    const panelHeight = panel.getBoundingClientRect().height;
    const closeThresholdPx = Math.min(Math.max(panelHeight * 0.22, 88), 180);
    const pointerId = event.pointerId;
    const startY = event.clientY;
    let dragOffset = 0;
    let lastY = startY;
    let lastTime = event.timeStamp;
    let velocityY = 0;

    panel.style.transition = "none";
    panel.style.willChange = "transform";

    const finish = (shouldClose: boolean) => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      panel.style.willChange = "";
      if (shouldClose) {
        panel.style.transition = "transform 0.35s cubic-bezier(0.4, 0, 1, 1)";
        panel.style.transform = "translateY(100%)";
        beginClose(true);
        return;
      }
      panel.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
      panel.style.transform = "translateY(0)";
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      dragOffset = Math.max(0, moveEvent.clientY - startY);
      panel.style.transform = `translateY(${dragOffset}px)`;
      if (dragOffset > 0) moveEvent.preventDefault();

      const dt = moveEvent.timeStamp - lastTime;
      if (dt > 0) velocityY = (moveEvent.clientY - lastY) / dt;
      lastY = moveEvent.clientY;
      lastTime = moveEvent.timeStamp;
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
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
  }, [beginClose, open, request]);

  if (!request) return null;

  return (
    <div
      aria-hidden={!open}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: "env(safe-area-inset-top, 0px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "stretch",
        pointerEvents: open ? "auto" : "none",
        opacity: open ? 1 : 0,
        transition: "opacity 0.28s ease",
      }}
    >
      <button
        type="button"
        aria-label={cancelText}
        onClick={() => beginClose(false)}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          opacity: open ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "relative",
          width: "100%",
          background: "var(--color-surface-container-low)",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          border: "1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent)",
          boxShadow: "0 -12px 48px var(--shadow-color-strong), 0 -2px 8px var(--shadow-color-soft)",
          padding: "var(--space-md)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--space-md))",
          maxHeight: "92vh",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "12px 0 8px",
            margin: "-4px calc(-1 * var(--space-md)) 0",
            cursor: "grab",
            userSelect: "none",
            touchAction: "none",
          }}
          onPointerDown={onHandlePointerDown}
        >
          <div
            aria-hidden="true"
            style={{
              width: 48,
              height: 4,
              borderRadius: 2,
              background: "var(--color-outline-variant)",
              opacity: 0.3,
            }}
          />
        </div>
        <div style={{ textAlign: "center", marginBottom: "var(--space-md)" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-headline-family)",
              fontSize: "16px",
              fontWeight: 800,
              letterSpacing: "-0.3px",
              color: "var(--color-text)",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
        </div>
        <div style={{ paddingBottom: "var(--space-md)" }}>
          <p style={{ margin: 0, whiteSpace: "pre-line", color: "var(--color-text-muted)", textAlign: "center" }}>
            {message}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xs)",
            width: "100%",
          }}
        >
          <PrimaryButton
            type="button"
            variant="primary"
            fullWidth
            onClick={() => beginClose(true)}
          >
            {confirmText}
          </PrimaryButton>
          <button
            type="button"
            className="btn btn-secondary btn-full"
            onClick={() => beginClose(false)}
          >
            {cancelText}
          </button>
        </div>
      </section>
    </div>
  );
});
