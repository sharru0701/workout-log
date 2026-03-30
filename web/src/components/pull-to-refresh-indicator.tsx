"use client";

import { useLocale } from "@/components/locale-provider";
import type { PullToRefreshStatus } from "@/lib/usePullToRefresh";

type PullToRefreshIndicatorProps = {
  pullOffset: number;
  progress: number;
  status: PullToRefreshStatus;
};

/**
 * iOS 26 Liquid Glass 스타일 PTR 인디케이터
 *
 * - pulling:    원형 진행 링 + 아래 화살표 (당길수록 링이 채워짐)
 * - armed:      링 완성 + 화살표 색상 강조 (햅틱 피드백 시점)
 * - refreshing: 글래스 컨트롤이 스피너로 전환
 * - complete:   스피너 페이드아웃 후 사라짐
 */
export function PullToRefreshIndicator({ pullOffset, progress, status }: PullToRefreshIndicatorProps) {
  const { locale } = useLocale();
  const isVisible = status !== "idle";
  const statusLabel =
    status === "refreshing" ? (locale === "ko" ? "새로고침 중" : "Refreshing") :
    status === "complete"   ? (locale === "ko" ? "새로고침 완료" : "Refresh complete") :
                              (locale === "ko" ? "아래로 당겨 새로고침" : "Pull down to refresh");

  // 인디케이터 컨테이너 높이 — refreshing/complete 는 고정 64 px
  const visibleHeight =
    status === "refreshing" || status === "complete"
      ? 64
      : Math.min(64, Math.max(0, pullOffset));

  const arrowProgress = Math.max(0, Math.min(1, progress));
  // 당길수록 위→아래 (0°→0°, 풀리면 180° 반전)
  const arrowRotation = arrowProgress * 180;
  const arrowTranslateY = Math.max(0, 10 - arrowProgress * 10);

  const isRefreshing = status === "refreshing" || status === "complete";

  // SVG 원형 진행 링 (r=15, circumference ≈ 94.2)
  const RING_R = 14;
  const RING_C = 2 * Math.PI * RING_R;
  const ringDashoffset = RING_C * (1 - arrowProgress);

  return (
    <div
      className="pull-to-refresh-indicator"
      style={{ height: `${visibleHeight}px` }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-status={status}
    >
      {isVisible ? (
        <div className="pull-to-refresh-indicator__content">
          {/* iOS 26 Liquid Glass 컨트롤 */}
          <div
            className="ptr-glass-control"
            data-refreshing={isRefreshing ? "true" : "false"}
            data-armed={status === "armed" ? "true" : "false"}
          >
            {/* 원형 진행 링 (pulling 단계) */}
            {!isRefreshing && (
              <svg
                className="ptr-progress-ring"
                viewBox="0 0 32 32"
                aria-hidden="true"
              >
                <circle
                  className="ptr-progress-ring__track"
                  cx="16" cy="16" r={RING_R}
                />
                <circle
                  className="ptr-progress-ring__fill"
                  cx="16" cy="16" r={RING_R}
                  style={{
                    strokeDasharray: RING_C,
                    strokeDashoffset: ringDashoffset,
                  }}
                />
              </svg>
            )}

            {/* 화살표 아이콘 */}
            <svg
              className="ptr-arrow-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{
                opacity: isRefreshing ? 0 : Math.max(0.2, arrowProgress),
                transform: `translateY(${arrowTranslateY}px) rotate(${arrowRotation}deg)`,
              }}
            >
              {/* 수직선 (당길수록 나타남) */}
              <line
                x1="12" y1="5" x2="12" y2="15"
                className="ptr-arrow-icon__stroke"
                style={{ opacity: arrowProgress }}
              />
              {/* 화살표 머리 */}
              <polyline
                points="8.5,11.5 12,15 15.5,11.5"
                className="ptr-arrow-icon__stroke"
              />
            </svg>

            {/* 회전 원호 스피너 (refreshing 단계) */}
            <svg
              className="ptr-spinner-arc"
              viewBox="0 0 36 36"
              aria-hidden="true"
            >
              <circle
                className="ptr-spinner-arc__circle"
                cx="18" cy="18" r="11"
              />
            </svg>

            <span className="sr-only">{statusLabel}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
