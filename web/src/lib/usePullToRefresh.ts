"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";

type PullToRefreshOptions = {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  completeDelayMs?: number;
};

export type PullToRefreshStatus = "idle" | "pulling" | "armed" | "refreshing" | "complete";

export function usePullToRefresh({
  onRefresh,
  threshold = 68,
  maxPull = 108,
  completeDelayMs = 720,
}: PullToRefreshOptions) {
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const completionTimeoutRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const scrollTargetRef = useRef<HTMLElement | null>(null);

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
    if (isRefreshing) return;
    clearCompletionTimeout();
    setIsCompleting(false);
    const target = event.currentTarget;
    if (target.scrollTop > 0) return;
    startXRef.current = event.touches[0]?.clientX ?? null;
    startYRef.current = event.touches[0]?.clientY ?? null;
    isPullingRef.current = startYRef.current !== null;
    scrollTargetRef.current = target;
  }, [clearCompletionTimeout, isRefreshing]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!isPullingRef.current || startYRef.current === null || isRefreshing) return;
    const target = scrollTargetRef.current ?? event.currentTarget;
    if (target.scrollTop > 0) {
      endPull();
      return;
    }

    const x = event.touches[0]?.clientX;
    const y = event.touches[0]?.clientY;
    if (typeof y !== "number") return;
    if (typeof x === "number" && startXRef.current !== null) {
      const horizontalDelta = Math.abs(x - startXRef.current);
      const verticalDelta = Math.abs(y - startYRef.current);
      if (horizontalDelta > Math.max(14, verticalDelta)) {
        endPull();
        return;
      }
    }
    const raw = y - startYRef.current;
    if (raw <= 0) {
      setPullOffset(0);
      return;
    }

    // Applies resistance so dragging feels spring-like, not linear.
    const resisted = Math.min(maxPull, Math.pow(raw, 0.86));
    setPullOffset(resisted);
    event.preventDefault();
  }, [endPull, isRefreshing, maxPull]);

  const onTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || isRefreshing) {
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
  }, [clearCompletionTimeout, completeDelayMs, endPull, isRefreshing, onRefresh, pullOffset, threshold]);

  const progress = Math.max(0, Math.min(1, pullOffset / threshold));
  const isArmed = pullOffset >= threshold;
  const status: PullToRefreshStatus = isRefreshing
    ? "refreshing"
    : isCompleting
      ? "complete"
      : pullOffset > 0
        ? isArmed
          ? "armed"
          : "pulling"
        : "idle";

  return {
    pullOffset,
    isRefreshing,
    isArmed,
    progress,
    status,
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
  };
}
