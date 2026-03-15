"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApiNetworkBusy } from "@/lib/ui/use-api-network-busy";
import { BaseGroupedList, InfoRow, NavigationRow, RowIcon } from "./settings-list";
import { useMaybeAppDialog } from "./app-dialog-provider";

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
  preferInline?: boolean;
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
    <BaseGroupedList ariaLabel={ariaLabel}>
      <InfoRow label={label} leading={<RowIcon symbol="LD" tone="info" />} />
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
    <BaseGroupedList ariaLabel={ariaLabel}>
      <InfoRow label={label} />
    </BaseGroupedList>
  );
}

export function ErrorStateRows({
  message,
  onRetry,
  retryDisabled = false,
  retryLabel = "다시 시도",
  title = "오류",
  ariaLabel = "Error state",
  className,
}: ErrorStateRowsProps) {
  const dialog = useMaybeAppDialog();
  const lastShownMessageRef = useRef<string | null>(null);
  const hasMessage = hasDialogMessage(message);
  const messageText = hasMessage ? toDialogText(message) : "";
  const titleText = toDialogText(title, "오류");
  const shouldUseDialog = Boolean(dialog && !onRetry && hasMessage && messageText);
  const dialogKey = messageText ? `${titleText}::${messageText}` : "";

  useEffect(() => {
    if (!shouldUseDialog || !dialog || !dialogKey) return;
    if (lastShownMessageRef.current === dialogKey) return;
    lastShownMessageRef.current = dialogKey;

    void (async () => {
      await dialog.alert({
        title: titleText,
        message: messageText,
        buttonText: "확인",
        tone: "danger",
      });
    })();
  }, [dialog, dialogKey, messageText, shouldUseDialog, titleText]);

  useEffect(() => {
    if (dialogKey) return;
    lastShownMessageRef.current = null;
  }, [dialogKey]);

  if (!message) return null;

  if (shouldUseDialog) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel}>
      <InfoRow tone="warning" label={message} leading={<RowIcon symbol="ER" tone="warning" />} />
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
    <BaseGroupedList ariaLabel={ariaLabel}>
      <InfoRow tone="disabled" label={label} leading={<RowIcon symbol="DS" tone="neutral" />} />
    </BaseGroupedList>
  );
}

export function NoticeStateRows({
  message,
  tone = "neutral",
  label = "안내",
  preferInline = false,
  ariaLabel = "Notice state",
  className,
}: NoticeStateRowsProps) {
  const dialog = useMaybeAppDialog();
  const lastShownMessageRef = useRef<string | null>(null);
  const hasMessage = hasDialogMessage(message);
  const messageText = hasMessage ? toDialogText(message) : "";
  const titleText = toDialogText(label, "안내");
  const dialogKey = messageText ? `${titleText}::${messageText}` : "";
  const shouldUseDialog = Boolean(dialog && dialogKey && !preferInline);

  useEffect(() => {
    if (!shouldUseDialog || !dialog || !dialogKey) return;
    if (lastShownMessageRef.current === dialogKey) return;
    lastShownMessageRef.current = dialogKey;

    void dialog.alert({
      title: titleText,
      message: messageText,
      buttonText: "확인",
      tone: tone === "warning" || tone === "critical" ? "danger" : "default",
    });
  }, [dialog, dialogKey, messageText, shouldUseDialog, titleText, tone]);

  useEffect(() => {
    if (dialogKey) return;
    lastShownMessageRef.current = null;
  }, [dialogKey]);

  if (!message) return null;

  if (shouldUseDialog) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel}>
      <InfoRow tone={tone} label={message} leading={<RowIcon symbol="NT" tone="surface" />} />
    </BaseGroupedList>
  );
}

function toDialogText(input: ReactNode | null | undefined, fallback = ""): string {
  if (input === null || input === undefined || input === false) return fallback;
  if (typeof input === "string" || typeof input === "number") return String(input).trim() || fallback;
  if (Array.isArray(input)) {
    const text = input
      .map((entry) => (typeof entry === "string" || typeof entry === "number" ? String(entry) : ""))
      .join(" ")
      .trim();
    return text || fallback;
  }
  return fallback;
}

function hasDialogMessage(input: ReactNode | null | undefined): boolean {
  if (input === null || input === undefined || input === false) return false;
  if (typeof input === "string") return input.trim().length > 0;
  if (typeof input === "number") return true;
  if (Array.isArray(input)) {
    return input.some((entry) => hasDialogMessage(entry as ReactNode));
  }
  return true;
}

export type {
  LoadingStateRowsProps,
  EmptyStateRowsProps,
  ErrorStateRowsProps,
  DisabledStateRowsProps,
  NoticeStateRowsProps,
};
