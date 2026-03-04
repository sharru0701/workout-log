"use client";

import { useEffect } from "react";
import { ErrorStateRows, NoticeStateRows } from "@/components/ui/settings-state";

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
      <section className="motion-card rounded-2xl border p-5 space-y-3">
        <h2 className="tab-screen-title">문제가 발생했습니다</h2>
        <ErrorStateRows
          message={error.message || "알 수 없는 렌더링 오류"}
          onRetry={() => reset()}
          retryLabel="다시 시도"
          title="화면을 불러오지 못했습니다"
        />
        <NoticeStateRows
          message={error.digest ? `Error ID: ${error.digest}` : null}
          label="디버그"
        />
      </section>
    </div>
  );
}
