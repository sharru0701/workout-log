"use client";

import type { PullToRefreshStatus } from "@/lib/usePullToRefresh";

type PullToRefreshIndicatorProps = {
  pullOffset: number;
  progress: number;
  status: PullToRefreshStatus;
};

const RADIUS = 8.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 53.41
const MAX_ARC_FRACTION = 0.80; // leave ~20% gap at the arrowhead
const SPINNER_COUNT = 12;
const SPINNER_PERIOD_MS = 1000;

export function PullToRefreshIndicator({ pullOffset, progress, status }: PullToRefreshIndicatorProps) {
  const isVisible = status !== "idle";
  const visibleHeight =
    status === "refreshing" || status === "complete"
      ? 52
      : Math.min(52, Math.max(0, pullOffset));

  const arcFraction = progress * MAX_ARC_FRACTION;
  const dashOffset = CIRCUMFERENCE * (1 - arcFraction);

  // End angle of the arc in radians (start is at -π/2 = 12 o'clock, grows clockwise)
  const endAngle = -Math.PI / 2 + arcFraction * 2 * Math.PI;
  const tipX = 12 + RADIUS * Math.cos(endAngle);
  const tipY = 12 + RADIUS * Math.sin(endAngle);
  // Tangent direction at end of arc (clockwise = +90° from radius)
  const tangentAngle = endAngle + Math.PI / 2;
  const arrowSize = 2.6;
  const b1x = tipX - arrowSize * Math.cos(tangentAngle - 0.55);
  const b1y = tipY - arrowSize * Math.sin(tangentAngle - 0.55);
  const b2x = tipX - arrowSize * Math.cos(tangentAngle + 0.55);
  const b2y = tipY - arrowSize * Math.sin(tangentAngle + 0.55);

  return (
    <div
      className="pull-to-refresh-indicator"
      style={{ height: `${visibleHeight}px` }}
      aria-hidden="true"
      data-status={status}
    >
      {isVisible && (
        <div className="pull-to-refresh-indicator__content">
          {status === "refreshing" || status === "complete" ? (
            // iOS-style activity indicator: 12 lines arranged in a circle
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
          ) : (
            // Circular arc progress indicator
            <svg
              className="ptr-arc-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              data-armed={status === "armed" ? "true" : undefined}
            >
              {/* Faint track ring */}
              <circle
                cx="12"
                cy="12"
                r={RADIUS}
                className="ptr-arc-track"
              />
              {/* Growing arc */}
              {progress > 0.02 && (
                <circle
                  cx="12"
                  cy="12"
                  r={RADIUS}
                  className="ptr-arc-fill"
                  strokeDasharray={`${CIRCUMFERENCE}`}
                  strokeDashoffset={`${dashOffset}`}
                  style={{ transform: "rotate(-90deg)", transformOrigin: "12px 12px" }}
                />
              )}
              {/* Arrowhead at the end of the arc */}
              {progress > 0.06 && (
                <polyline
                  points={`${b1x},${b1y} ${tipX},${tipY} ${b2x},${b2y}`}
                  className="ptr-arc-arrow"
                />
              )}
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
