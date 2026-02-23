"use client";

import { useCallback, useRef, useState } from "react";
import type { TouchEvent } from "react";

type PullToRefreshOptions = {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
};

export function usePullToRefresh({
  onRefresh,
  threshold = 68,
  maxPull = 108,
}: PullToRefreshOptions) {
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const scrollTargetRef = useRef<HTMLElement | null>(null);

  const endPull = useCallback(() => {
    startYRef.current = null;
    isPullingRef.current = false;
    scrollTargetRef.current = null;
    setPullOffset(0);
  }, []);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (isRefreshing) return;
    const target = event.currentTarget;
    if (target.scrollTop > 0) return;
    startYRef.current = event.touches[0]?.clientY ?? null;
    isPullingRef.current = startYRef.current !== null;
    scrollTargetRef.current = target;
  }, [isRefreshing]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!isPullingRef.current || startYRef.current === null || isRefreshing) return;
    const target = scrollTargetRef.current ?? event.currentTarget;
    if (target.scrollTop > 0) {
      endPull();
      return;
    }

    const y = event.touches[0]?.clientY;
    if (typeof y !== "number") return;
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
    } finally {
      setIsRefreshing(false);
    }
  }, [endPull, isRefreshing, onRefresh, pullOffset, threshold]);

  return {
    pullOffset,
    isRefreshing,
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
  };
}
