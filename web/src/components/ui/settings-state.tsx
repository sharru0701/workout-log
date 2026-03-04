"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApiNetworkBusy } from "@/lib/ui/use-api-network-busy";
import { BaseGroupedList, InfoRow, NavigationRow, RowIcon } from "./settings-list";

type LoadingStateRowsProps = {
  active: boolean;
  delayMs?: number;
  label?: ReactNode;
  description?: ReactNode;
  ariaLabel?: string;
  className?: string;
};

type EmptyStateRowsProps = {
  when: boolean;
  label?: ReactNode;
  description?: ReactNode;
  ariaLabel?: string;
  className?: string;
  deferWhileNetworkBusy?: boolean;
  maxDeferMs?: number;
  revealDelayMs?: number;
};

type ErrorStateRowsProps = {
  message: ReactNode | null;
  onRetry?: () => void;
  retryDisabled?: boolean;
  retryLabel?: ReactNode;
  title?: ReactNode;
  ariaLabel?: string;
  className?: string;
};

type DisabledStateRowsProps = {
  when: boolean;
  label?: ReactNode;
  description?: ReactNode;
  ariaLabel?: string;
  className?: string;
};

type NoticeStateRowsProps = {
  message: ReactNode | null;
  tone?: "neutral" | "success" | "warning" | "critical";
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
};

export function useDelayedVisibility(active: boolean, delayMs = 420) {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    const minVisibleMs = 180;
    if (active) {
      if (visible) return;
      const timer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => {
        window.clearTimeout(timer);
      };
    }

    if (!visible) {
      shownAtRef.current = null;
      return;
    }

    const shownAt = shownAtRef.current;
    if (shownAt === null) {
      setVisible(false);
      return;
    }

    const remaining = Math.max(minVisibleMs - (Date.now() - shownAt), 0);
    if (remaining === 0) {
      shownAtRef.current = null;
      setVisible(false);
      return;
    }

    const hideTimer = window.setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
    return () => {
      window.clearTimeout(hideTimer);
    };
  }, [active, delayMs, visible]);

  return visible;
}

export function LoadingStateRows({
  active,
  delayMs = 420,
  label = "불러오는 중",
  ariaLabel = "Loading state",
  className,
}: LoadingStateRowsProps) {
  const [effectiveDelayMs, setEffectiveDelayMs] = useState(delayMs);

  useEffect(() => {
    if (!active) {
      setEffectiveDelayMs(delayMs);
      return;
    }
    if (typeof document === "undefined") {
      setEffectiveDelayMs(delayMs);
      return;
    }
    const hasTabRouteTransition =
      document.documentElement.hasAttribute("data-tab-route-direction") ||
      document.documentElement.hasAttribute("data-tab-route-pending-direction");
    setEffectiveDelayMs(delayMs + (hasTabRouteTransition ? 260 : 0));
  }, [active, delayMs]);

  const visible = useDelayedVisibility(active, effectiveDelayMs);
  if (!visible) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow label={label} leading={<RowIcon symbol="LD" tone="blue" />} />
    </BaseGroupedList>
  );
}

export function EmptyStateRows({
  when,
  label = "설정 값 없음",
  ariaLabel = "Empty state",
  className,
  deferWhileNetworkBusy = true,
  maxDeferMs = 540,
  revealDelayMs = 120,
}: EmptyStateRowsProps) {
  const networkBusy = useApiNetworkBusy();
  const [networkGateOpen, setNetworkGateOpen] = useState(false);

  useEffect(() => {
    if (!when) {
      setNetworkGateOpen(false);
      return;
    }
    if (!deferWhileNetworkBusy || !networkBusy) {
      setNetworkGateOpen(true);
      return;
    }
    setNetworkGateOpen(false);
    const timer = window.setTimeout(() => {
      setNetworkGateOpen(true);
    }, maxDeferMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [deferWhileNetworkBusy, maxDeferMs, networkBusy, when]);

  const visible = useDelayedVisibility(when && networkGateOpen, revealDelayMs);
  if (!visible) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow label={label} leading={<RowIcon symbol="EM" tone="neutral" />} />
    </BaseGroupedList>
  );
}

export function ErrorStateRows({
  message,
  onRetry,
  retryDisabled = false,
  retryLabel = "다시 시도",
  ariaLabel = "Error state",
  className,
}: ErrorStateRowsProps) {
  if (!message) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow tone="warning" label={message} leading={<RowIcon symbol="ER" tone="orange" />} />
      <NavigationRow
        label={retryLabel}
        onPress={onRetry}
        disabled={retryDisabled || !onRetry}
        showChevron={Boolean(onRetry && !retryDisabled)}
        leading={<RowIcon symbol="RT" tone="neutral" />}
      />
    </BaseGroupedList>
  );
}

export function DisabledStateRows({
  when,
  label = "현재 사용할 수 없음",
  ariaLabel = "Disabled state",
  className,
}: DisabledStateRowsProps) {
  if (!when) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow tone="disabled" label={label} leading={<RowIcon symbol="DS" tone="neutral" />} />
    </BaseGroupedList>
  );
}

export function NoticeStateRows({
  message,
  tone = "neutral",
  ariaLabel = "Notice state",
  className,
}: NoticeStateRowsProps) {
  if (!message) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow tone={tone} label={message} leading={<RowIcon symbol="NT" tone="tint" />} />
    </BaseGroupedList>
  );
}

export type {
  LoadingStateRowsProps,
  EmptyStateRowsProps,
  ErrorStateRowsProps,
  DisabledStateRowsProps,
  NoticeStateRowsProps,
};
