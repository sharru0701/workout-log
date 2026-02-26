# PR23 - UX Presets, Snapshot Export, And Cleanup Ops Guide

## Goal
- Add UX-specific filter presets in dashboard so PM/QA can focus on behavior windows quickly.
- Add dashboard snapshot export for UX review sharing.
- Document production scheduling for UX event retention cleanup job.

## Scope (Implemented)
- Dashboard UX preset controls:
  - Added `오늘 / 7일 / 14일` UX 분석 프리셋 buttons.
  - Preset behavior:
    - sets date range to exact window (`from/to`)
    - forces bucket to `day` for UX inspection
  - Active preset highlight when current range matches a UX window.
- Dashboard UX snapshot export:
  - Added `스냅샷 JSON` and `스냅샷 CSV` buttons in UX 행동 요약 section.
  - Export payload includes:
    - selected filters (plan/range/bucket)
    - UX funnel summary
    - UX summary windows (1/7/14 day) and trends
- Range header clarity:
  - Range card now shows actual custom date range when `from/to` is active.
- Stats index copy update:
  - UX row description now mentions 1/7/14 UX snapshot.
- Ops scheduling guide:
  - Added runbook with cron/GitHub Actions/dry-run rollout instructions.

## New/Updated Surfaces
- Dashboard:
  - `src/app/stats/dashboard/page.tsx`
- Stats index:
  - `src/app/stats/page.tsx`
- Ops guide:
  - `docs/ops-ux-events-cleanup-scheduling.md`

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/app/stats/dashboard/page.tsx src/app/stats/page.tsx`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR24:
  - Add API-level UX snapshot endpoint (`/api/stats/ux-snapshot`) with JSON/CSV export
  - Add lightweight dashboard annotations for expected UX baseline thresholds
