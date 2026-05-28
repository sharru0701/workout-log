"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { V2PrimaryBtn, V2SecondaryBtn } from "@/components/v2/primitives";
import type { PendingRestorePrompt } from "@/features/workout-log/model/editor-actions";

type RestoreDraftSheetProps = {
  request: PendingRestorePrompt | null;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onResolve: (keep: boolean) => void;
};

const CLOSE_DELAY_MS = 420;

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

  useEffect(() => {
    if (request) {
      closingRef.current = false;
      setOpen(true);
      return;
    }
    setOpen(false);
  }, [request]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const beginClose = useCallback(
    (keep: boolean) => {
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
      }, CLOSE_DELAY_MS);
    },
    [onResolve, request],
  );

  if (!request) return null;

  return (
    <BottomSheet
      open={open}
      onClose={() => beginClose(false)}
      headless
      title={title}
      closeLabel={cancelText}
    >
      <div style={{ padding: "var(--v2-s-4) var(--v2-s-4) var(--v2-s-2)" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--v2-s-4)" }}>
          <h2 className="v2-h3" style={{ lineHeight: 1.3 }}>
            {title}
          </h2>
        </div>
        <div style={{ paddingBottom: "var(--v2-s-4)" }}>
          <p
            className="v2-body"
            style={{
              whiteSpace: "pre-line",
              color: "var(--v2-ink-2)",
              textAlign: "center",
            }}
          >
            {message}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--v2-s-2)",
            width: "100%",
          }}
        >
          <V2PrimaryBtn full onClick={() => beginClose(true)}>
            {confirmText}
          </V2PrimaryBtn>
          <V2SecondaryBtn full onClick={() => beginClose(false)}>
            {cancelText}
          </V2SecondaryBtn>
        </div>
      </div>
    </BottomSheet>
  );
});
