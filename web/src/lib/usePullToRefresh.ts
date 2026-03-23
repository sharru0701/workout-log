"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, TouchEvent } from "react";

export type PullToRefreshStatus = "idle" | "pulling" | "armed" | "refreshing" | "complete";

type PullToRefreshOptions = {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  completeDelayMs?: number;
  enabled?: boolean;
};

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

/**
 * PWA 표준 준수: 독립 실행 모드(standalone/fullscreen/minimal-ui)에서만
 * 커스텀 PTR을 활성화합니다. 일반 브라우저 모드에서는 브라우저 기본
 * 새로고침(iOS 26 Safari 네이티브 PTR 포함)을 사용합니다.
 */
function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

function getSafeAreaInsetTop() {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--safe-area-top").trim();
  const parsed = Number.parseFloat(raw.replace("px", ""));
  return Number.isFinite(parsed) ? parsed : 0;
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
  enabled,
}: PullToRefreshOptions) {
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const completionTimeoutRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  useEffect(() => {
    setIsSupported(isStandaloneDisplayMode());
  }, []);

  const isEnabled = enabled ?? isSupported;

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
    setPullOffset(0);
  }, []);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!isEnabled || isRefreshing) return;

    clearCompletionTimeout();
    setIsCompleting(false);

    // 스크롤이 최상단이 아니면 PTR 시작 안 함
    if (getRootScrollTop() > 0) return;

    const touch = event.touches[0];
    if (!touch) return;

    // 화면 최상단(safe area 포함) 영역에서만 시작 — 표준 PTR 트리거 영역
    const safeTop = getSafeAreaInsetTop();
    if (touch.clientY > safeTop + 120) return;

    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    isPullingRef.current = true;
  }, [clearCompletionTimeout, isEnabled, isRefreshing]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!isEnabled || !isPullingRef.current || startYRef.current === null || isRefreshing) return;

    if (getRootScrollTop() > 0) {
      endPull();
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;

    // 수평 스와이프이면 PTR 취소
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

    // 저항 물리 — iOS UIScrollView와 동일한 감쇠 곡선
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
      await Promise.all([
        onRefresh(),
        new Promise<void>((resolve) => setTimeout(resolve, 500)),
      ]);
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
      style: {
        touchAction: "pan-y",
        // standalone 모드에서 브라우저 overscroll bounce 방지
        overscrollBehaviorY: "contain",
      },
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
