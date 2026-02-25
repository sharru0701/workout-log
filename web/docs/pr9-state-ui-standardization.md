# PR9 State UI Standardization

Date: 2026-02-25
Goal: Standardize loading/empty/error/disabled state UI across app screens and lists to iOS Settings tone.

## 1) State Component / Pattern Definition

### Core components

- `LoadingStateRows`
  - Intent: Minimal loading hint only, shown after delay.
  - Rule: No skeleton-first UI. Uses delayed appearance (`default delayMs=420`).
- `EmptyStateRows`
  - Intent: Empty states are rendered as InfoRow-style grouped row.
  - Default label: `설정 값 없음`.
- `ErrorStateRows`
  - Intent: No red warning box. Inline warning info + retry action row.
  - Structure: warning info row + retry row (`NavigationRow` action).
- `DisabledStateRows`
  - Intent: Gray informational state with footnote-style description and no tap action.
  - Structure: disabled-tone `InfoRow`.
- `NoticeStateRows`
  - Intent: Neutral/success/warning notices in grouped row style.

### Supporting behavior

- `useDelayedVisibility(active, delayMs)` hook added for delayed loading hint.
- `NavigationRow` extended with `showChevron?: boolean` for non-navigable semantic rows.
- `InfoRow` tone extended with `disabled`.

## 2) Applied Screens (Full pass)

- `plans/manage`
  - Loading/error/empty plan list/disabled selected-plan state converted to State Rows.
- `templates/manage`
  - Loading/error/success/empty/disabled(read-only) states converted to State Rows.
- `calendar/manage`
  - Loading/error/empty/disabled states converted to State Rows.
- `stats/dashboard`
  - Loading/error + chart/table empty states converted to State Rows.
- `workout/session/[logId]`
  - Loading/error/empty compare table converted to State Rows.
- `workout/today/log`
  - Loading/error/success/empty/disabled states converted to State Rows.
- `app/error`
  - Runtime error view converted to inline error + retry row style.

## 3) Files Added / Updated

- Added:
  - `src/components/ui/settings-state.tsx`
  - `src/app/settings/state-samples/page.tsx`
  - `docs/pr9-state-ui-standardization.md`
- Updated:
  - `src/components/ui/settings-list.tsx`
  - `src/components/ui/settings-list.module.css`
  - `src/components/ui/settings-list.example.tsx`
  - `src/app/settings/page.tsx`
  - `src/app/plans/manage/page.tsx`
  - `src/app/templates/manage/page.tsx`
  - `src/app/calendar/manage/page.tsx`
  - `src/app/stats/dashboard/page.tsx`
  - `src/app/workout/session/[logId]/page.tsx`
  - `src/app/workout/today/log/page.tsx`
  - `src/app/error.tsx`

## 4) Sample Screen / Story-like Preview

- Added sample route:
  - `/settings/state-samples`
- Purpose:
  - Toggle and inspect `loading`, `empty`, `error`, `disabled`, `notice` states in one place.
  - Serves as a lightweight Storybook substitute in current project setup.
- Screenshot status:
  - Playwright capture was attempted but blocked by missing system browser dependencies in the current environment (`libnspr4.so` and related libs).

## 5) Validation

- `pnpm --dir web exec tsc --noEmit` passed.
- `pnpm --dir web build` passed.
