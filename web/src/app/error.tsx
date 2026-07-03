"use client";

import { useEffect } from "react";
import { V2Card, V2PrimaryBtn } from "@/components/v2/primitives";
import { normalizeLocalePreference } from "@/lib/settings/workout-preferences";

type ErrorWithDigest = Error & { digest?: string };

export default function RootError({
  error,
  reset,
}: {
  error: ErrorWithDigest;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App render error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const locale =
    typeof document === "undefined"
      ? "ko"
      : normalizeLocalePreference(document.documentElement.lang);

  return (
    // data-app-error-boundary: E2E 스모크가 렌더 크래시(에러 바운더리 노출)를 명확히 감지하는
    // 전용 마커. "다시 시도" 텍스트는 정상 retry UI에도 쓰여 false-positive라 텍스트 대신 이 속성으로 게이트.
    <div data-app-error-boundary="segment" style={{ padding: "var(--v2-s-5)" }}>
      <V2Card tone="paper" padding="var(--v2-s-5)">
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--v2-s-3)",
          }}
        >
          <p className="v2-eyebrow" style={{ color: "var(--v2-c-danger)" }}>
            {locale === "ko" ? "오류" : "ERROR"}
          </p>
          <h2 className="v2-h2">
            {locale === "ko"
              ? "화면을 불러오지 못했습니다"
              : "Could not load the screen"}
          </h2>
          <p className="v2-body" style={{ color: "var(--v2-ink-2)" }}>
            {error.message ||
              (locale === "ko"
                ? "알 수 없는 렌더링 오류"
                : "Unknown rendering error")}
          </p>
          <V2PrimaryBtn icon="refresh" onClick={() => reset()}>
            {locale === "ko" ? "다시 시도" : "Retry"}
          </V2PrimaryBtn>
          {error.digest ? (
            <p
              className="v2-mono-label"
              style={{ color: "var(--v2-ink-3)", marginTop: "var(--v2-s-2)" }}
            >
              Error ID: {error.digest}
            </p>
          ) : null}
        </div>
      </V2Card>
    </div>
  );
}
