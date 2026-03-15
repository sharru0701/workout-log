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
    <div>
      <Card as="section" padding="lg" role="alert" aria-live="assertive">
        <div>
          <p>오류</p>
          <h2>화면을 불러오지 못했습니다</h2>
          <p>
            {error.message || "알 수 없는 렌더링 오류"}
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => reset()}
          >
            다시 시도
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
