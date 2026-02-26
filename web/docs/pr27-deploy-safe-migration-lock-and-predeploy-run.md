# PR27 - Deploy-Safe Migration Lock And Pre-Deploy Run

## Goal
- Make migrations safer in real deployment environments (restart, concurrent starts, CI deploy).
- Prevent accidental app swap when migration fails.

## Scope (Implemented)
- Hardened migration runner (`web/scripts/migrate.mjs`):
  - Added optional DB advisory lock to serialize concurrent migration attempts
  - Added configurable lock wait/poll settings
  - Added `DB_MIGRATE_ENABLED=0` skip mode
- Deploy pipeline hardening (`.github/workflows/deploy.yml`):
  - Runs one-shot migration before switching web container image:
    - `docker compose run --rm web node scripts/migrate.mjs`
  - If migration fails, deployment step fails before app replacement
- Ops restart script hardening (`deploy/scripts/restart_workoutlog.sh`):
  - Added `MIGRATE_FIRST=1` default
  - Runs one-shot migration before stack restart
- Deployment config updates:
  - Added migration env knobs in `deploy/docker-compose.yml`
  - Added documented defaults in `deploy/.env.example`
- Ops docs updates:
  - Added migration lock/log expectations and one-shot verification steps in `deploy/README_DEPLOY.md`

## New/Updated Surfaces
- `web/scripts/migrate.mjs`
- `.github/workflows/deploy.yml`
- `deploy/scripts/restart_workoutlog.sh`
- `deploy/docker-compose.yml`
- `deploy/.env.example`
- `deploy/README_DEPLOY.md`

## Key Env Knobs
- `DB_MIGRATE_ENABLED` (default `1`)
- `DB_MIGRATE_USE_ADVISORY_LOCK` (default `1`)
- `DB_MIGRATE_LOCK_ID` (default `872341`)
- `DB_MIGRATE_LOCK_MAX_WAIT_MS` (default `180000`)
- `DB_MIGRATE_LOCK_POLL_MS` (default `1500`)
- `DB_MIGRATE_MAX_ATTEMPTS` (default `30`)
- `DB_MIGRATE_RETRY_DELAY_MS` (default `2000`)

## Verification
- Syntax check:
  - `node --check web/scripts/migrate.mjs`
- Skip-mode run:
  - `DB_MIGRATE_ENABLED=0 DATABASE_URL=postgres://... node web/scripts/migrate.mjs`
- Lint/Typecheck (affected app/server files):
  - `pnpm --dir web exec eslint src/app/api/settings/route.ts src/app/api/stats/ux-snapshot/route.ts src/app/stats/dashboard/page.tsx src/app/settings/ux-thresholds/page.tsx src/app/settings/page.tsx src/lib/settings/settings-search-index.ts src/server/db/schema.ts`
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR28:
  - Add dedicated migration job/container for zero-downtime multi-replica rollout
  - Add migration telemetry endpoint/alerts for lock timeout and failures
