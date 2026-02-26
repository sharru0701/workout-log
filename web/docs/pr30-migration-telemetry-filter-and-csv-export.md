# PR30 - Migration Telemetry Filter And CSV Export

## Goal
- Improve migration telemetry readability in dashboard with quick filter controls.
- Add lightweight CSV export for migration run logs.

## Scope (Implemented)
- API enhancement: `GET /api/stats/migration-telemetry`
  - Added `runStatus` filter:
    - `ALL` (default), `ISSUE`, `SUCCESS`, `RUNNING`, `LOCK_TIMEOUT`, `FAILED`, `SKIPPED`
  - Added `format=csv` export
  - Added `filters` block in payload for applied params
  - JSON behavior unchanged (`critical` => HTTP 503)
  - CSV always returns downloadable `200` response
- Dashboard enhancement: `/stats/dashboard`
  - Added migration lookback quick presets (`2h`, `12h`, `24h`, `3일`)
  - Added status-only toggle (`문제 상태만 ON/OFF`)
  - Added CSV link next to JSON in migration section
  - Migration telemetry fetch moved to dedicated effect:
    - Handles `503` JSON payloads (critical state) without collapsing section
    - Keeps core stats loading independent of telemetry control changes

## Explicitly Out Of Scope
- Scheduled alert/ping automation is still excluded by user request.

## New/Updated Surfaces
- `src/app/api/stats/migration-telemetry/route.ts`
- `src/app/stats/dashboard/page.tsx`
- `docs/pr30-migration-telemetry-filter-and-csv-export.md`

## Verification
- `pnpm --dir web exec eslint src/app/api/stats/migration-telemetry/route.ts src/app/stats/dashboard/page.tsx src/app/stats/page.tsx`
- `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR31:
  - migration telemetry section micro-UX polish (table sort + row detail sheet)
  - optional include/exclude `RUNNING` in issue filter
