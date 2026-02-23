"use client";

import { useEffect } from "react";

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
    <div className="mx-auto max-w-xl p-6 space-y-3">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-600">Please retry. If it keeps happening, check server logs.</p>
      {error.digest ? <p className="text-xs text-gray-500">Error ID: {error.digest}</p> : null}
      <button
        type="button"
        className="rounded border px-3 py-2 text-sm"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
