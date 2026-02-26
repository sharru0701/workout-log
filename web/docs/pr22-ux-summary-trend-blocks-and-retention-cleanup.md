# PR22 - UX Summary Trend Blocks And Retention Cleanup

## Goal
- Expose server-based UX summary trend blocks (today / 7d / 14d) in stats dashboard.
- Add a retention cleanup job for `ux_event_log` so UX telemetry storage does not grow unbounded.

## Scope (Implemented)
- Expanded `GET /api/stats/ux-events-summary`:
  - Added rates in response:
    - `saveSuccessFromClicks`
    - `generateSuccessFromClicks`
    - `addAfterSheetOpen`
    - `repeatSuccessFromClicks`
    - `saveSuccessFromOpens`
  - Added `comparePrev=1` support with same-length previous window
  - Added `trend` deltas (counts + key conversion rates)
  - Kept existing fields (`from`, `to`, `rangeDays`, `totalEvents`, `summary`) backward compatible
- Updated dashboard UX section:
  - Added `UX 행동 요약 (오늘/7일/14일)` card group
  - Fetches server summary for `1/7/14` day windows with `comparePrev=1`
  - Shows core counts and conversion stability trend per window
- Added retention cleanup job:
  - New script: `src/server/db/cleanupUxEventLog.ts`
  - New npm command: `pnpm --dir web run db:cleanup:ux-events`
  - Env options:
    - `UX_EVENTS_RETENTION_DAYS` (default: `120`)
    - `UX_EVENTS_CLEANUP_DRY_RUN=1` for no-delete check
  - Handles missing table (`42P01`) by skip (safe before migration rollout)

## New/Updated Surfaces
- API:
  - `src/app/api/stats/ux-events-summary/route.ts`
- Dashboard:
  - `src/app/stats/dashboard/page.tsx`
- Maintenance job:
  - `src/server/db/cleanupUxEventLog.ts`
- Package script:
  - `package.json` (`db:cleanup:ux-events`)

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/app/stats/dashboard/page.tsx src/app/api/stats/ux-events-summary/route.ts src/server/db/cleanupUxEventLog.ts`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`
- Cleanup dry-run:
  - `UX_EVENTS_CLEANUP_DRY_RUN=1 UX_EVENTS_RETENTION_DAYS=99999 pnpm --dir web run db:cleanup:ux-events`

## Next PR Candidate
- PR23:
  - Add dashboard filter preset for UX-only windows and export snapshot
  - Add scheduled execution guide (cron/vercel/CI) for `db:cleanup:ux-events`
