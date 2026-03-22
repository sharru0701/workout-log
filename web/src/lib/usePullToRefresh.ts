"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, TouchEvent } from "react";

type PullToRefreshOptions = {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  completeDelayMs?: number;
  triggerSelector?: string;
  enabled?: boolean;
};

export type PullToRefreshStatus = "idle" | "pulling" | "armed" | "refreshing" | "complete";

type PullToRefreshBind = {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  style: CSSProperties;
  "data-ptr-enabled": "true" | "false";
};

const DISABLED_BIND: PullToRefreshBind = {
  onTouchStart: () => {},
  onTouchMove: () => {},
  onTouchEnd: () => {},
  onTouchCancel: () => {},
  style: { touchAction: "pan-y" },
  "data-ptr-enabled": "false",
};

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

function getRootScrollTop() {
  if (typeof window === "undefined") return 0;
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 72,
  maxPull = 120,
  completeDelayMs = 720,
  triggerSelector,
  enabled,
}: PullToRefreshOptions) {
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const completionTimeoutRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const scrollTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsStandalone(isStandaloneDisplayMode());
  }, []);

  const isEnabled = enabled ?? isStandalone;

  const clearCompletionTimeout = useCallback(() => {
    if (completionTimeoutRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(completionTimeoutRef.current);
    completionTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearCompletionTimeout();
    };
  }, [clearCompletionTimeout]);

  const endPull = useCallback(() => {
    startXRef.current = null;
    startYRef.current = null;
    isPullingRef.current = false;
    scrollTargetRef.current = null;
    setPullOffset(0);
  }, []);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!isEnabled || isRefreshing) return;

    clearCompletionTimeout();
    setIsCompleting(false);

    if (getRootScrollTop() > 0) return;

    const touch = event.touches[0];
    if (!touch) return;

    const source = event.target instanceof Element ? event.target : null;
    const trigger = triggerSelector ? source?.closest(triggerSelector) : event.currentTarget;
    if (!trigger || !event.currentTarget.contains(trigger)) return;

    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    isPullingRef.current = true;
    scrollTargetRef.current = event.currentTarget;
  }, [clearCompletionTimeout, isEnabled, isRefreshing, triggerSelector]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!isEnabled || !isPullingRef.current || startYRef.current === null || isRefreshing) return;

    if (getRootScrollTop() > 0) {
      endPull();
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;

    if (startXRef.current !== null) {
      const horizontalDelta = Math.abs(touch.clientX - startXRef.current);
      const verticalDelta = Math.abs(touch.clientY - startYRef.current);
      if (horizontalDelta > Math.max(16, verticalDelta)) {
        endPull();
        return;
      }
    }

    const raw = touch.clientY - startYRef.current;
    if (raw <= 0) {
      setPullOffset(0);
      return;
    }

    const resisted = Math.min(maxPull, Math.pow(raw, 0.84));
    setPullOffset(resisted);

    if (raw > 2) {
      event.preventDefault();
    }
  }, [endPull, isEnabled, isRefreshing, maxPull]);

  const onTouchEnd = useCallback(async () => {
    if (!isEnabled || !isPullingRef.current || isRefreshing) {
      endPull();
      return;
    }

    const shouldRefresh = pullOffset >= threshold;
    endPull();
    if (!shouldRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      clearCompletionTimeout();
      setIsCompleting(true);
      if (typeof window !== "undefined") {
        completionTimeoutRef.current = window.setTimeout(() => {
          setIsCompleting(false);
          completionTimeoutRef.current = null;
        }, completeDelayMs);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [clearCompletionTimeout, completeDelayMs, endPull, isEnabled, isRefreshing, onRefresh, pullOffset, threshold]);

  const progress = Math.max(0, Math.min(1, pullOffset / threshold));
  const isArmed = pullOffset >= threshold;
  const status: PullToRefreshStatus = !isEnabled
    ? "idle"
    : isRefreshing
      ? "refreshing"
      : isCompleting
        ? "complete"
        : pullOffset > 0
          ? isArmed
            ? "armed"
            : "pulling"
          : "idle";

  const bind = useMemo<PullToRefreshBind>(() => {
    if (!isEnabled) return DISABLED_BIND;
    return {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
      style: { touchAction: "pan-y", overscrollBehaviorY: "none" },
      "data-ptr-enabled": "true",
    };
  }, [isEnabled, onTouchEnd, onTouchMove, onTouchStart]);

  return {
    pullOffset,
    isRefreshing,
    isArmed,
    progress,
    status,
    isEnabled,
    bind,
  };
}
