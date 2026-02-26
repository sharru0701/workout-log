# PR20 - UX Funnel Dashboard And Guided Hints

## Goal
- Provide server-side funnel aggregation and export for UX flow monitoring.
- Guide first-time users in workout logging based on tracked local drop-off behavior.

## Scope (Implemented)
- Added server funnel API:
  - `GET /api/stats/ux-funnel`
  - Supports range (`days` or `from`/`to`), optional `planId`, optional `comparePrev=1`
  - Supports `format=json|csv` for export
- Added UX funnel card in stats dashboard:
  - Step counts: session generate -> log save -> save with extra exercise
  - Conversion rates and trend deltas
  - Largest drop-off step highlight
  - CSV download button
- Added local-event guided hints in workout log:
  - Uses recent tracked events to infer likely next action
  - Renders a single primary guidance card with one action button
  - Keeps advanced capabilities intact (no feature removal)

## Data Sources
- Server funnel:
  - `generated_session`, `workout_log`, `workout_set`
- Guided hint:
  - local tracked events from `workoutlog:ux-events`

## New/Updated Surfaces
- API:
  - `src/app/api/stats/ux-funnel/route.ts`
- Dashboard:
  - `src/app/stats/dashboard/page.tsx`
- Stats index shortcut:
  - `src/app/stats/page.tsx` (`UX 퍼널` row)
- Workout hints + action wiring:
  - `src/app/workout/today/log/page.tsx`
- Event helper expansion:
  - `src/lib/workout-ux-events.ts`

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/app/api/stats/ux-funnel/route.ts src/app/stats/dashboard/page.tsx src/app/stats/page.tsx src/app/workout/today/log/page.tsx src/lib/workout-ux-events.ts`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Candidate
- PR21:
  - Persist client UX events server-side for cross-device funnel continuity
  - Add date/plan presets for funnel report exports
  - Add alert thresholds for severe drop-off segments
