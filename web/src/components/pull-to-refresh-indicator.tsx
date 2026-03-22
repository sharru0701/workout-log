"use client";

import type { PullToRefreshStatus } from "@/lib/usePullToRefresh";

type PullToRefreshIndicatorProps = {
  pullOffset: number;
  progress: number;
  status: PullToRefreshStatus;
  pullLabel?: string;
  releaseLabel?: string;
  refreshingLabel: string;
  completeLabel?: string;
};

function resolveLabel({
  status,
  pullLabel,
  releaseLabel,
  refreshingLabel,
  completeLabel,
}: Omit<PullToRefreshIndicatorProps, "pullOffset" | "progress">) {
  if (status === "refreshing") return refreshingLabel;
  if (status === "complete") return completeLabel ?? "새로고침 완료";
  if (status === "armed") return releaseLabel ?? "놓으면 새로고침";
  if (status === "pulling") return pullLabel ?? "당겨서 새로고침";
  return "";
}

export function PullToRefreshIndicator(props: PullToRefreshIndicatorProps) {
  const {
    pullOffset,
    progress,
    status,
    pullLabel = "당겨서 새로고침",
    releaseLabel = "놓으면 새로고침",
    refreshingLabel,
    completeLabel = "새로고침 완료",
  } = props;

  const isVisible = status !== "idle";
  const visibleHeight = status === "refreshing" || status === "complete"
    ? 60
    : Math.min(60, Math.max(0, pullOffset));
  const rotation = -90 + progress * 180;

  return (
    <div
      className="pull-to-refresh-indicator"
      style={{ height: `${visibleHeight}px` }}
      aria-hidden={!isVisible}
      data-status={status}
    >
      <div className="pull-to-refresh-indicator__content">
        <span className="pull-to-refresh-indicator__glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <g style={{ transform: status === "refreshing" ? undefined : `rotate(${rotation}deg)` }}>
              <path d="M12 3.75a8.25 8.25 0 1 0 7.78 10.95" />
              <path d="M15.45 3.9h4.8v4.8" />
            </g>
            {status === "complete" ? <path d="m8.2 12.2 2.45 2.45 5.15-5.25" /> : null}
          </svg>
        </span>
        <div className="pull-to-refresh-indicator__label" aria-live="polite" aria-atomic="true">
          {resolveLabel({ status, pullLabel, releaseLabel, refreshingLabel, completeLabel })}
        </div>
      </div>
    </div>
  );
}
