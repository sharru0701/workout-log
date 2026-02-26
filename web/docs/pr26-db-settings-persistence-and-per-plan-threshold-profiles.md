# PR26 - DB Settings Persistence And Per-Plan Threshold Profiles

## Goal
- Replace in-memory settings snapshot with DB-backed persistence.
- Support per-plan UX threshold profiles and apply them in UX snapshot analytics.

## Scope (Implemented)
- Added DB table for settings persistence:
  - `user_setting` (`user_id`, `key`, `value`, timestamps)
  - Unique `(user_id, key)`
- Added migration:
  - `0009_sturdy_meridian.sql`
  - migration journal updated (`idx: 9`)
- Reworked `/api/settings`:
  - `GET` now reads persisted settings from DB and merges defaults
  - `PATCH` upserts setting rows in DB
  - Keeps safe fallback behavior when table is missing (pre-migration environments)
- Added per-plan threshold profile UI:
  - New route: `/settings/ux-thresholds`
  - Global threshold controls (existing)
  - New plan-scoped overrides:
    - `prefs.uxThreshold.plan.{planId}.saveFromGenerate`
    - `prefs.uxThreshold.plan.{planId}.saveSuccessFromClicks7d`
    - `prefs.uxThreshold.plan.{planId}.addAfterSheetOpen14d`
  - Plan override clear action (set `null` to fall back)
- Dashboard threshold resolution update:
  - Loads settings snapshot
  - Resolves thresholds as `plan override -> global`
  - Applies resolved targets to `/api/stats/ux-snapshot` queries and export links
- `ux-snapshot` API enhancement:
  - Accepts target overrides from query params
  - Includes `previous` absolute values in funnel/windows for compare mode
  - Includes threshold target metadata in payload and CSV

## New/Updated Surfaces
- DB schema/migration:
  - `src/server/db/schema.ts`
  - `src/server/db/migrations/0009_sturdy_meridian.sql`
  - `src/server/db/migrations/meta/_journal.json`
- Settings API/UI:
  - `src/app/api/settings/route.ts`
  - `src/app/settings/ux-thresholds/page.tsx`
  - `src/app/settings/page.tsx`
  - `src/lib/settings/settings-search-index.ts`
- Stats:
  - `src/app/stats/dashboard/page.tsx`
  - `src/app/api/stats/ux-snapshot/route.ts`

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/server/db/schema.ts src/app/api/settings/route.ts src/app/api/stats/ux-snapshot/route.ts src/app/stats/dashboard/page.tsx src/app/settings/ux-thresholds/page.tsx src/app/settings/page.tsx src/lib/settings/settings-search-index.ts`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR27:
  - Add explicit per-plan threshold enable/disable toggles
  - Add audit log stream for threshold changes and settings writes
