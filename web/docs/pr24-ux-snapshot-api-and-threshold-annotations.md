# PR24 - UX Snapshot API And Threshold Annotations

## Goal
- Add API-level UX snapshot export (`/api/stats/ux-snapshot`) with JSON/CSV output.
- Add lightweight baseline annotations in dashboard to surface UX risk quickly.

## Scope (Implemented)
- Added snapshot API:
  - `GET /api/stats/ux-snapshot`
  - Supports range (`days` or `from`/`to`), optional `planId`, `comparePrev=1`, `windows=1,7,14`, `format=json|csv`
  - Returns:
    - funnel summary (server)
    - UX summary windows (1/7/14, with trends)
    - threshold annotations (`ok`/`warn`) with hints
  - Cached with `stats_cache` (`metric: ux_snapshot`)
- Dashboard wiring update:
  - Replaced client-only snapshot export generation with API export links
    - `스냅샷 JSON`
    - `스냅샷 CSV`
  - Dashboard data load now uses `ux-snapshot` payload for:
    - UX funnel card data
    - UX 1/7/14 summary windows
    - baseline threshold cards
- Baseline threshold annotation cards added under UX summary:
  - `세션 생성→저장 전환율`
  - `7일 저장 클릭→성공율`
  - `14일 시트 오픈→운동 추가율`

## New/Updated Surfaces
- API:
  - `src/app/api/stats/ux-snapshot/route.ts`
- Dashboard:
  - `src/app/stats/dashboard/page.tsx`

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/app/stats/dashboard/page.tsx src/app/api/stats/ux-snapshot/route.ts`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR25:
  - Add snapshot compare mode (current vs previous window table)
  - Add threshold customization via settings (team/project specific targets)
