"use client";

import type { CSSProperties } from "react";
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
    ? 58
    : Math.min(58, Math.max(0, pullOffset));
  const arrowRotation = -20 + progress * 200;
  const style = {
    height: `${visibleHeight}px`,
    "--pull-progress": progress.toFixed(3),
  } as CSSProperties;

  return (
    <div
      className={`pull-refresh-indicator${isVisible ? " is-visible" : ""} is-${status}`}
      style={style}
      aria-hidden={!isVisible}
    >
      <div className="pull-refresh-indicator__track">
        <span className="pull-refresh-indicator__icon-shell" aria-hidden="true">
          <svg className="pull-refresh-indicator__icon-svg" viewBox="0 0 24 24" focusable="false">
            <g
              className="pull-refresh-indicator__arrow"
              style={{ transform: `rotate(${arrowRotation}deg)` }}
            >
              <path d="M12 4.75v10.5" />
              <path d="m7.75 11.5 4.25 4.25 4.25-4.25" />
            </g>
            <path className="pull-refresh-indicator__spinner" d="M20 12a8 8 0 1 1-3.1-6.34" />
            <path className="pull-refresh-indicator__check" d="m8.25 12.35 2.35 2.4 5.15-5.35" />
          </svg>
        </span>
        <div className="pull-refresh-indicator__copy" aria-live="polite" aria-atomic="true">
          <span className="pull-refresh-indicator__label">
            {resolveLabel({ status, pullLabel, releaseLabel, refreshingLabel, completeLabel })}
          </span>
          <span className="pull-refresh-indicator__meter" aria-hidden="true">
            <span className="pull-refresh-indicator__meter-fill" />
          </span>
        </div>
      </div>
    </div>
  );
}
