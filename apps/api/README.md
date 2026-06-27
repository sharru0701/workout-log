# ironlog-api (apps/api)

Standalone **Hono** backend (Node + Drizzle + node-postgres) that reuses the
shared business logic in `web/src/server/**` and exposes it with **token (Bearer)
auth** — so non-browser clients (the Go TUI in `apps/tui`) authenticate cleanly
without the cookie-scraping hack.

## Status: B1 in progress (logs group ported)
- Reuses `web/src/server` source via the `@/*` → `../../web/src/*` tsconfig alias.
  Web stays untouched apart from **additive, non-breaking** shared helpers
  (`server/db/ops.ts`, `getSettingsSnapshotForUser`); physical extraction to
  `packages/core` is a later phase.
- Auth: `Authorization: Bearer <token>` **or** the `wl_session` cookie, both
  validated by the existing `auth_session` token (`findActiveSession`).
- Routes:
  - `GET /health`, `POST /api/auth/login` (mints + returns a token),
    `GET /api/auth/me`, `GET /api/plans`.
  - **logs** (`src/routes/logs.ts`): `GET`/`POST /api/logs`,
    `GET /api/logs/calendar`, `GET`/`PATCH`/`DELETE /api/logs/:logId` —
    cursor list, create/replace (shared `upsertWorkoutLogService`), month
    calendar, and detail with server-detected personal records.
- Next-isms are replaced by `src/lib/http.ts`: `requireAuth` supplies the user
  id (no `cookies()`), `apiError`/`resolveLocale`/`normalizeTimezone` stand in
  for `apiErrorResponse`/`resolveRequestLocale`, and `apiLogger` replaces the
  `withApiLogging` request wrapper.
- Remaining B1 groups: exercises, stats, settings, plans CRUD, and misc.

## Run
```bash
pnpm -C apps/api install
DATABASE_URL=... pnpm -C apps/api start   # PORT defaults to 8787
# curl http://localhost:8787/health
# curl -H "Authorization: Bearer <token>" http://localhost:8787/api/auth/me
```

`DATABASE_URL` is the same Postgres connection string the web app uses.

## Roadmap
- **B1**: port the remaining routes — logs ✅, then stats, exercises, settings, plans CRUD, misc.
- **B2**: deploy independently (VPS/Railway) + point the TUI at it via Bearer; optionally migrate web client calls.
- **B-extract**: move `web/src/server` → `packages/core` for a clean shared package (repo-wide import rewrite).
