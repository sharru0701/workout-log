# PR25 - UX Compare Mode And Custom Threshold Settings

## Goal
- Add dashboard compare mode so current UX metrics can be read against previous window in one table.
- Allow team/project-specific UX threshold customization instead of fixed hardcoded targets.

## Scope (Implemented)
- Extended `GET /api/stats/ux-snapshot`:
  - Added query-based threshold targets:
    - `targetSaveFromGenerate`
    - `targetSaveSuccessFromClicks7d`
    - `targetAddAfterSheetOpen14d`
  - Added `previous` absolute values for funnel/windows when `comparePrev=1`
  - Added threshold target metadata into payload `filters.thresholdTargets`
  - Included threshold target values in CSV export metadata
  - Included threshold targets in cache params to avoid stale mixed-target responses
- Dashboard updates:
  - Loads UX threshold settings from `/api/settings`
  - Passes custom threshold targets to `ux-snapshot` API and export links
  - Added `비교 모드` toggle in UX 행동 요약 section
  - Added `현재 vs 이전 구간 비교` table for key funnel/window metrics
  - Added quick link to `/settings/ux-thresholds`
- New settings screen:
  - `설정 > UX 기준치` (`/settings/ux-thresholds`)
  - Adjust and persist three threshold targets with optimistic update + rollback
  - Includes reset-to-default action
- Settings plumbing:
  - Added default settings keys:
    - `prefs.uxThreshold.saveFromGenerate`
    - `prefs.uxThreshold.saveSuccessFromClicks7d`
    - `prefs.uxThreshold.addAfterSheetOpen14d`
  - Added settings index navigation row and settings search index entry

## New/Updated Surfaces
- API:
  - `src/app/api/stats/ux-snapshot/route.ts`
  - `src/app/api/settings/route.ts`
- Dashboard:
  - `src/app/stats/dashboard/page.tsx`
- Settings UI:
  - `src/app/settings/ux-thresholds/page.tsx`
  - `src/app/settings/page.tsx`
- Settings search index:
  - `src/lib/settings/settings-search-index.ts`

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/app/api/stats/ux-snapshot/route.ts src/app/stats/dashboard/page.tsx src/app/settings/ux-thresholds/page.tsx src/app/settings/page.tsx src/app/api/settings/route.ts src/lib/settings/settings-search-index.ts`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR26:
  - Persist settings in DB (currently in-memory snapshot for dev/demo)
  - Add per-plan threshold profile support and apply in `ux-snapshot` queries
