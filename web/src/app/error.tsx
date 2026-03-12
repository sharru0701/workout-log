"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";

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

  return (
    <div className="native-page native-page-enter tab-screen">
      <Card as="section" padding="lg" className="space-y-4" role="alert" aria-live="assertive">
        <div className="space-y-1">
          <p className="ui-card-label">오류</p>
          <h2 className="tab-screen-title">화면을 불러오지 못했습니다</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {error.message || "알 수 없는 렌더링 오류"}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="ui-primary-button"
            onClick={() => reset()}
          >
            다시 시도
          </button>
          {error.digest ? (
            <p className="text-xs text-[var(--text-tertiary)]">
              Error ID: {error.digest}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
