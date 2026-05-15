import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7),

    tracesSampleRate: 0,
    profilesSampleRate: 0,

    sendDefaultPii: false,

    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],

    beforeSend(event) {
      const url = event.request?.url ?? "";
      if (url.includes("/api/health")) return null;

      if (
        process.env.NODE_ENV !== "production" &&
        process.env.VERCEL_ENV !== "production"
      ) {
        console.warn("[Sentry server dev] would send", event.exception);
        return null;
      }
      return event;
    },
  });
}
