# ironlog-api (apps/api)

Standalone **Hono** backend (Node + Drizzle + node-postgres) that reuses the
shared business logic in `web/src/server/**` and exposes it with **token (Bearer)
auth** — so non-browser clients (the Go TUI in `apps/tui`) authenticate cleanly
without the cookie-scraping hack.

## Status: B0 vertical slice
- Reuses `web/src/server` source via the `@/*` → `../../web/src/*` tsconfig alias
  (web is untouched; physical extraction to `packages/core` is a later phase).
- Auth: `Authorization: Bearer <token>` **or** the `wl_session` cookie, both
  validated by the existing `auth_session` token (`findActiveSession`).
- Routes: `GET /health`, `POST /api/auth/login` (mints + returns a token),
  `GET /api/auth/me`, `GET /api/plans`. Remaining ~54 routes are B1.

## Run
```bash
pnpm -C apps/api install
DATABASE_URL=... pnpm -C apps/api start   # PORT defaults to 8787
# curl http://localhost:8787/health
# curl -H "Authorization: Bearer <token>" http://localhost:8787/api/auth/me
```

`DATABASE_URL` is the same Postgres connection string the web app uses.

## Roadmap
- **B1**: port the remaining routes (logs, stats, exercises, settings, plans CRUD, …).
- **B2**: deploy independently (VPS/Railway) + point the TUI at it via Bearer; optionally migrate web client calls.
- **B-extract**: move `web/src/server` → `packages/core` for a clean shared package (repo-wide import rewrite).
