# PR18 - Workout Log Add Exercise Flow

## Goal
- Keep advanced controls intact.
- Make "add extra exercise while logging" obvious and fast for beginners.

## Scope (Implemented)
- Added dedicated `+ 운동 추가` entry points in workout log:
  - Quick action panel
  - Advanced action panel
  - Empty state panel
- Added new add-exercise bottom sheet:
  - Search input
  - One-tap pick from recommended/registered exercises
  - Manual text add when search text exists
- Added append logic that auto-increments set number per exercise name.
- Updated top flow copy to clarify action order:
  - Generate/apply -> add/log -> save

## Non-Regression
- Existing advanced actions remain available:
  - Week/day generate
  - Planned set apply
  - Quick add from selected set
  - Session override operations
  - Row-level copy/insert/remove controls

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/components/bottom-nav.tsx src/app/page.tsx src/app/workout/today/page.tsx src/app/workout/today/log/page.tsx src/app/plans/manage/page.tsx`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Plan
- PR20:
  - Instrumented funnel dashboard wiring (server aggregation/export)
  - Guided first-run hints using tracked drop-off points
