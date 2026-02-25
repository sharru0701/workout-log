# PR10 Selection Input UX

Date: 2026-02-25
Goal: Complete iOS Settings-style value input flow where `ValueRow` opens a child screen and selected/input value is reflected immediately on return.

## 1) Selection Screen Template (Component + Route Template)

### Core template components

- `src/components/ui/selection-screen-template.tsx`
  - `SingleSelectionScreen`
  - `MultiSelectionScreen`
  - `PickerSelectionScreen`
  - Shared option model: `SelectionOption`
  - Optional search input and filtered result list

### Route template / sample page

- `src/app/settings/selection-template/page.tsx`
  - Single selection sample (radio/checkmark style)
  - Multi selection sample (iOS checkmark style)
  - Searchable selection sample (search input + result list)
  - Date/time/number picker samples

## 2) Refactored Existing Input/Setting Screens

### Plans

- `src/app/plans/context/page.tsx`
  - Context fields are converted to `ValueRow` entries.
  - Each row now routes to `select/[field]` or `picker/[field]`.
- `src/app/plans/context/select/[field]/page.tsx`
  - Single selection fields: `user-id`, `session-key-mode`, `timezone`.
- `src/app/plans/context/picker/[field]/page.tsx`
  - Picker fields: `start-date`, `week`, `day`.

### Calendar

- `src/app/calendar/options/page.tsx`
  - Option values are converted to `ValueRow` entries.
  - Each row routes to `select/[field]` or `picker/[field]`.
- `src/app/calendar/options/select/[field]/page.tsx`
  - Single selection fields: `view-mode`, `auto-open`, `timezone`.
- `src/app/calendar/options/picker/[field]/page.tsx`
  - Picker field: `open-time`.

### Stats

- `src/app/stats/filters/page.tsx`
  - Filter values are converted to `ValueRow` entries.
  - Each row routes to `select/[field]` or `picker/[field]`.
- `src/app/stats/filters/select/[field]/page.tsx`
  - Single selection: `plan-scope`, `bucket`, `exercise`
  - Multi selection: `metrics`
- `src/app/stats/filters/picker/[field]/page.tsx`
  - Picker fields: `days`, `from`, `to`.

## 3) Back Navigation State Reflection Rules

### Source of truth

- Parent settings screen values are query-driven.
- Child selection/picker screen receives `returnTo` (parent path + current query).
- On confirm/select, child updates query via `withPatchedQuery(returnTo, patch)` and routes back.

### Rule by pattern

- Single selection
  - One tap commits value and immediately routes to parent with updated query.
  - Parent row reflects value instantly from URL query.
- Multi selection
  - Toggle does local selection state only.
  - `Apply & Back` commits the normalized CSV value and routes to parent.
- Picker (date/time/number)
  - Input edits local state.
  - `Apply & Back` commits value and routes to parent.
  - Number picker normalizes to positive integer (`>= 1`).

### Safety/consistency rules

- `returnTo` must be a safe relative path (`/`-started, no `//`); otherwise fallback route is used.
- Empty values can be removed from query (optional fields like `from`/`to`).
- Multi values are deduplicated and stored as normalized CSV.
- Invalid/unknown field route renders inline error row and provides retry navigation.

## 4) Shared Utilities and Data

- `src/lib/selection-navigation.ts`
  - `normalizeReturnTo`
  - `withPatchedQuery`
  - `readParamFromHref`
  - `parseCsvParam`
  - `toCsvParam`
- `src/lib/selection-options.ts`
  - Shared option lists for timezone, exercise, stats scope, and metrics.

## 5) Validation

- `pnpm --dir web exec tsc --noEmit` passed.
- `pnpm --dir web build` passed.
