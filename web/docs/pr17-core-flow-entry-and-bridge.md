# PR17 - Core Flow Entry And Bridge

## Goal
- Make the main journey obvious without removing advanced controls.
- Enforce two primary paths:
  - Program select -> workout log -> save
  - Custom program create -> select -> workout log -> save

## Scope (Implemented)
- `BottomNav` now opens action-first routes:
  - `Today` -> `/workout/today/log`
  - `Plans` -> `/plans/manage`
- Home (`/`) now shows flow-first quick actions instead of category-first navigation.
- Today index (`/workout/today`) now emphasizes the primary flow and isolates advanced tools.
- Plans workspace (`/plans/manage`) now bridges to workout logging directly:
  - Deep links from each plan card to `/workout/today/log?planId=...&date=...&autoGenerate=1`
  - Selected plan deep link in the top action zone
  - `?create=1&type=SINGLE|COMPOSITE|MANUAL` query support to open the create sheet directly
  - Post-create success notice and immediate next action CTA

## Non-Regression Policy
- No advanced feature removed:
  - Template/version management
  - Composite/manual plan creation
  - Advanced generation context (week/day/sessionKey mode)
  - Snapshot preview/manual generation controls

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/components/bottom-nav.tsx src/app/page.tsx src/app/workout/today/page.tsx src/app/plans/manage/page.tsx`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`

## Next PR Plan
- PR19:
  - Beginner/Power explicit mode framing in log screen
  - Korean microcopy pass for action clarity
  - Event instrumentation for funnel metrics
  - Usability validation checklist and acceptance gates
