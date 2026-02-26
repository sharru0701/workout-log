# PR28 - Dedicated Migration Job And Ops Telemetry Alerts

## Goal
- Make rollout safer for multi-replica deployment by separating migration execution from web container startup.
- Add migration telemetry and alert surface for lock timeout/failure detection.

## Scope (Implemented)
- Added dedicated migration service in deploy compose:
  - `migrate` service runs `node scripts/migrate.mjs`
  - `web` defaults to `WEB_DB_MIGRATE_ENABLED=0` to avoid startup race in scaled rollout
- Updated deploy/restart orchestration:
  - CI deploy runs `docker compose run --rm migrate` before `web` switch
  - restart script runs dedicated migration job first (default), then restarts `postgres` + `web`
- Added migration execution telemetry:
  - `migration_run_log` table (migration `0010_solid_watchtower.sql`)
  - migration runner logs `RUNNING/SUCCESS/LOCK_TIMEOUT/FAILED/SKIPPED`
  - captures lock wait and error code/message
- Added ops endpoint:
  - `GET /api/ops/migrations` (token-protected via `OPS_MIGRATION_TOKEN`)
  - returns pending migrations, telemetry availability, recent runs, and alert summary
  - returns `503` on critical status (pending migrations or recent failures/timeouts)
- CI alert integration:
  - Optional deploy telemetry step via `DEPLOY_OPS_TOKEN`
  - strict mode available via `DEPLOY_MIGRATION_ALERT_STRICT=1`

## New/Updated Surfaces
- `deploy/docker-compose.yml`
- `deploy/.env.example`
- `deploy/scripts/restart_workoutlog.sh`
- `.github/workflows/deploy.yml`
- `deploy/README_DEPLOY.md`
- `web/scripts/migrate.mjs`
- `web/src/app/api/ops/migrations/route.ts`
- `web/src/server/db/schema.ts`
- `web/src/server/db/migrations/0010_solid_watchtower.sql`
- `web/src/server/db/migrations/meta/_journal.json`

## New/Updated Env Knobs
- `MIGRATE_DB_MIGRATE_ENABLED` (default `1`)
- `MIGRATE_DB_MIGRATE_RUNNER` (default `compose-migrate-job`)
- `WEB_DB_MIGRATE_ENABLED` (default `0`)
- `WEB_DB_MIGRATE_RUNNER` (default `web-startup`)
- `DB_MIGRATE_TELEMETRY_ENABLED` (default `1`)
- `OPS_MIGRATION_TOKEN` (optional, enables `/api/ops/migrations`)

## Deploy Alert Controls
- GitHub Secret:
  - `DEPLOY_OPS_TOKEN` (should match server-side `OPS_MIGRATION_TOKEN`)
- GitHub Variables:
  - `DEPLOY_MIGRATION_ALERT_LOOKBACK_MINUTES` (default `120`)
  - `DEPLOY_MIGRATION_ALERT_STRICT` (`1` => fail deploy on critical telemetry)

## Verification
- `node --check web/scripts/migrate.mjs`
- `bash -n deploy/scripts/restart_workoutlog.sh`
- `POSTGRES_PASSWORD=dummy NEXT_PUBLIC_APP_URL=http://localhost docker compose -f deploy/docker-compose.yml config -q`
- `pnpm --dir web exec eslint src/app/api/ops/migrations/route.ts src/server/db/schema.ts src/app/api/health/route.ts src/app/api/settings/route.ts`
- `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR29:
  - Add migration telemetry dashboard widget in `/stats/dashboard` for ops visibility
  - Add scheduled alert/ping workflow for unattended drift detection
