# PR21 - Server UX Event Sync And Cross-Device Hints

## Goal
- Persist workout-log UX events on the server so guided hints and funnel analysis survive device changes.
- Keep beginner-first flow guidance accurate while preserving advanced controls.

## Scope (Implemented)
- Added UX event ingestion API:
  - `POST /api/ux-events`
  - Validates event shape (`id`, `name`, `recordedAt`, primitive `props`)
  - Caps batch size (`<= 200`), de-duplicates by event id in request
  - Idempotent insert with conflict ignore (`userId + clientEventId`)
- Added server UX summary API:
  - `GET /api/stats/ux-events-summary`
  - Supports date range (`days` or `from`/`to`, default 14 days)
  - Returns event totals + guided-hint summary counters
  - Uses `stats_cache` (`metric: ux_events_summary`)
- Added DB persistence for UX events:
  - New table `ux_event_log`
  - Indexes for per-user timeline and per-event-type range scans
- Wired workout log page sync lifecycle:
  - Initial mount sync
  - Online recovery sync
  - Threshold auto-sync when unsynced event buffer grows
  - Manual sync button/status in header badge row
- Corrected hint aggregation to avoid double counting:
  - Guided hint summary now uses `server summary + local unsynced summary`
  - Falls back to local summary when server summary is unavailable

## New/Updated Surfaces
- API:
  - `src/app/api/ux-events/route.ts`
  - `src/app/api/stats/ux-events-summary/route.ts`
- Workout log UX sync integration:
  - `src/app/workout/today/log/page.tsx`
- Client UX event helper:
  - `src/lib/workout-ux-events.ts`
- DB schema/migration:
  - `src/server/db/schema.ts`
  - `src/server/db/migrations/0008_lush_polaris.sql`
  - `src/server/db/migrations/meta/_journal.json`

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/app/api/ux-events/route.ts src/app/api/stats/ux-events-summary/route.ts src/app/workout/today/log/page.tsx src/lib/workout-ux-events.ts src/server/db/schema.ts`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR22:
  - Expose server UX summary trend blocks in stats dashboard (today/7d/14d)
  - Add per-event retention window cleanup job for `ux_event_log`
