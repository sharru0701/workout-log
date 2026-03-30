"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
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
    <div>
      <Card as="section" padding="lg" role="alert" aria-live="assertive">
        <div>
          <p>{locale === "ko" ? "오류" : "Error"}</p>
          <h2>{locale === "ko" ? "화면을 불러오지 못했습니다" : "Could not load the screen"}</h2>
          <p>
            {error.message || (locale === "ko" ? "알 수 없는 렌더링 오류" : "Unknown rendering error")}
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => reset()}
          >
            {locale === "ko" ? "다시 시도" : "Retry"}
          </button>
          {error.digest ? (
            <p>
              Error ID: {error.digest}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
