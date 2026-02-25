"use client";

import { useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active, delayMs]);

  return visible;
}

export function LoadingStateRows({
  active,
  delayMs = 420,
  label = "불러오는 중",
  description = "잠시 후 자동으로 갱신됩니다.",
  ariaLabel = "Loading state",
  className,
}: LoadingStateRowsProps) {
  const visible = useDelayedVisibility(active, delayMs);
  if (!visible) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow label={label} description={description} leading={<RowIcon symbol="LD" tone="blue" />} />
    </BaseGroupedList>
  );
}

export function EmptyStateRows({
  when,
  label = "설정 값 없음",
  description = "현재 표시할 설정 값이 없습니다.",
  ariaLabel = "Empty state",
  className,
}: EmptyStateRowsProps) {
  if (!when) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow label={label} description={description} leading={<RowIcon symbol="EM" tone="neutral" />} />
    </BaseGroupedList>
  );
}

export function ErrorStateRows({
  message,
  onRetry,
  retryDisabled = false,
  retryLabel = "다시 시도",
  title = "요청을 완료하지 못했습니다",
  ariaLabel = "Error state",
  className,
}: ErrorStateRowsProps) {
  if (!message) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow tone="warning" label={title} description={message} leading={<RowIcon symbol="ER" tone="orange" />} />
      <NavigationRow
        label={retryLabel}
        description="문제가 계속되면 입력값을 확인한 뒤 다시 시도하세요."
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
  description = "필수 조건을 채우면 사용할 수 있습니다.",
  ariaLabel = "Disabled state",
  className,
}: DisabledStateRowsProps) {
  if (!when) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow tone="disabled" label={label} description={description} leading={<RowIcon symbol="DS" tone="neutral" />} />
    </BaseGroupedList>
  );
}

export function NoticeStateRows({
  message,
  tone = "neutral",
  label = "안내",
  ariaLabel = "Notice state",
  className,
}: NoticeStateRowsProps) {
  if (!message) return null;

  return (
    <BaseGroupedList ariaLabel={ariaLabel} className={className}>
      <InfoRow tone={tone} label={label} description={message} leading={<RowIcon symbol="NT" tone="tint" />} />
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
