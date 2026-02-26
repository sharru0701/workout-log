# PR19 - Beginner/Power Mode And Funnel Events

## Goal
- Keep advanced controls fully available while reducing clutter for first-time logging.
- Add measurable funnel instrumentation for core workout flow.

## Scope (Implemented)
- Added explicit logging modes on `/workout/today/log`:
  - `기본 모드`: core flow focused
  - `고급 모드`: advanced controls + snapshot/compare
- Added one-step promotion from beginner to advanced:
  - `고급 제어 열기`
  - `세션 상세 비교 열기(고급 모드)`
- Kept non-regression guarantees:
  - Advanced generation controls
  - Session override workflow
  - Snapshot and compare surfaces
  - Existing row-level controls
- Microcopy pass (Korean action-first wording) on major workout-log actions and success/error messages.
- Added client-side funnel event tracker:
  - New utility: `src/lib/workout-ux-events.ts`
  - Stores recent events in localStorage (`workoutlog:ux-events`)
  - Emits browser event (`workoutlog:ux-event`) for debug tooling

## Instrumented Events
- `workout_log_opened`
- `workout_focus_mode_changed`
- `workout_plan_changed`
- `workout_generate_apply_clicked`
- `workout_generate_apply_succeeded`
- `workout_generate_apply_failed`
- `workout_add_exercise_sheet_opened`
- `workout_add_exercise_sheet_closed`
- `workout_add_exercise_added`
- `workout_add_exercise_failed`
- `workout_repeat_last_clicked`
- `workout_repeat_last_succeeded`
- `workout_repeat_last_failed`
- `workout_save_clicked`
- `workout_save_succeeded`
- `workout_save_failed`
- `workout_override_sheet_opened`

## Acceptance Checklist
- Beginner path:
  - Generate/apply -> add exercise -> save is visible without opening advanced sections.
- Power path:
  - All existing advanced actions are reachable within one mode switch.
- Add-exercise path:
  - Open sheet from quick/advanced/empty states and append set row.
- Save path:
  - Online save, offline queue save, fallback queue save all preserve success messaging.
- Event path:
  - Core actions append event entries into `workoutlog:ux-events`.

## Verification
- Lint:
  - `pnpm --dir web exec eslint src/components/bottom-nav.tsx src/app/page.tsx src/app/workout/today/page.tsx src/app/workout/today/log/page.tsx src/app/plans/manage/page.tsx src/lib/workout-ux-events.ts`
- Typecheck:
  - `pnpm --dir web exec tsc --noEmit`
