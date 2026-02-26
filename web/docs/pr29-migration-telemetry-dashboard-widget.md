# PR29 - Migration Telemetry Dashboard Widget

## Goal
- Expose deploy migration health directly in stats dashboard so 운영 점검 시 별도 로그 탐색 없이 상태를 확인할 수 있게 한다.
- Keep existing analytics flow stable even when telemetry endpoint fails.

## Scope (Implemented)
- Added stats API for migration telemetry:
  - `GET /api/stats/migration-telemetry`
  - Returns migration drift (`local/applied/pending`), recent run logs, alert summary
  - Status classification: `ok | warn | critical`
  - `critical` on pending migration / recent failure / recent lock-timeout
- Added dashboard ops widget:
  - New section in `/stats/dashboard`: "운영 마이그레이션 상태"
  - Shows status badge, drift count, alert counters, lock wait metrics, recent run table
  - Includes JSON link (`/api/stats/migration-telemetry`)
  - Dashboard keeps loading core stats even if telemetry call fails (`catch => null`)
- Updated stats index:
  - Added "운영 마이그레이션 상태" entry under `/stats`

## Explicitly Out Of Scope (By Request)
- Scheduled alert/ping automation was intentionally excluded from PR29.

## New/Updated Surfaces
- `src/app/api/stats/migration-telemetry/route.ts`
- `src/app/stats/dashboard/page.tsx`
- `src/app/stats/page.tsx`

## Verification
- `pnpm --dir web exec eslint src/app/api/stats/migration-telemetry/route.ts src/app/stats/dashboard/page.tsx src/app/stats/page.tsx`
- `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR30:
  - migration telemetry widget filter refinements (lookback quick presets, status-only toggle)
  - lightweight CSV export for migration run logs
