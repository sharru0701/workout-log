"use client";

import type { PullToRefreshStatus } from "@/lib/usePullToRefresh";

type PullToRefreshIndicatorProps = {
  pullOffset: number;
  progress: number;
  status: PullToRefreshStatus;
};

const SPINNER_COUNT = 12;
const SPINNER_PERIOD_MS = 1000;

export function PullToRefreshIndicator({ pullOffset, progress, status }: PullToRefreshIndicatorProps) {
  const isVisible = status !== "idle";
  const visibleHeight =
    status === "refreshing" || status === "complete"
      ? 60
      : Math.min(60, Math.max(0, pullOffset));

  const arrowProgress = Math.max(0, Math.min(1, progress));
  const rotation = -180 + arrowProgress * 180;
  const translateY = Math.max(0, 14 - arrowProgress * 14);
  const isRefreshing = status === "refreshing" || status === "complete";

  return (
    <div
      className="pull-to-refresh-indicator"
      style={{ height: `${visibleHeight}px` }}
      aria-hidden="true"
      data-status={status}
    >
      {isVisible ? (
        <div className="pull-to-refresh-indicator__content">
          <div className="ptr-apple-control" data-refreshing={isRefreshing ? "true" : "false"}>
            <svg
              className="ptr-apple-arrow"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{
                opacity: isRefreshing ? 0 : 1,
                transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
              }}
            >
              <path
                d="M12 5v10"
                className="ptr-apple-arrow__stroke"
                pathLength="1"
                style={{ strokeDashoffset: `${1 - arrowProgress}` }}
              />
              <path d="M8.5 11.5 12 15l3.5-3.5" className="ptr-apple-arrow__stroke" />
            </svg>

            <span className="ptr-spinner" role="status" aria-label="새로고침 중">
              {Array.from({ length: SPINNER_COUNT }, (_, i) => (
                <span
                  key={i}
                  className="ptr-spinner__line"
                  style={{
                    transform: `rotate(${i * (360 / SPINNER_COUNT)}deg)`,
                    animationDelay: `-${((SPINNER_COUNT - i) / SPINNER_COUNT) * (SPINNER_PERIOD_MS / 1000)}s`,
                  }}
                />
              ))}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
