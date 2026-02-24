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
    <div className="native-page native-page-enter tab-screen">
      <section className="motion-card rounded-2xl border p-5 space-y-3">
        <h2 className="tab-screen-title">Something went wrong</h2>
        <p className="tab-screen-caption">Please retry. If it keeps happening, check server logs.</p>
        {error.digest ? <p className="type-caption">Error ID: {error.digest}</p> : null}
        <button
          type="button"
          className="haptic-tap ui-primary-button"
          onClick={() => reset()}
        >
          Try again
        </button>
      </section>
    </div>
  );
}
