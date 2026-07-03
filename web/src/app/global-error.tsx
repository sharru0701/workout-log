"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      {/* data-app-error-boundary: 루트 레이아웃 크래시(#491 F4 류)를 E2E 스모크가 감지하는 전용 마커. */}
      <body data-app-error-boundary="root">
        <button onClick={reset}>다시 시도</button>
      </body>
    </html>
  );
}
