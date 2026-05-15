import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7),

    tracesSampleRate: 0,

    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],

    beforeSend(event) {
      if (
        process.env.NODE_ENV !== "production" &&
        process.env.VERCEL_ENV !== "production"
      ) {
        return null;
      }
      return event;
    },
  });
}
