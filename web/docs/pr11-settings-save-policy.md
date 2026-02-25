# PR11 Settings Save Policy Standardization

Date: 2026-02-25  
Goal: Make toggle/value changes feel immediately applied (iOS Settings style) while standardizing rollback and row-level loading behavior.

## 1) Save Policy (Local / Server / Cache Priority)

### Priority order

1. Optimistic UI state (immediate reflect)
2. Local cache write (same tick as optimistic UI)
3. Server persist (authoritative sync)
4. Canonical response reconcile (if server returns adjusted value)

### Read/boot priority

1. Local cache value (`SettingStore.read`)
2. Server value passed into screen/hook
3. Fallback default value

### Failure policy

- On server persist failure:
  - Roll back UI value to previous value immediately
  - Roll back local cache to previous value
  - Show inline error message + rollback notice
- No global loading overlay is used.
- Only the row currently being persisted is disabled.

### Duplicate-input policy

- Same row ignores new commit requests while `pending=true`.
- This prevents double-tap races for toggle/value rows.

## 2) Common Hook / Service

### Service layer

- `src/lib/settings/update-setting.ts`
  - `updateSetting(...)`
    - optimistic apply
    - local cache write
    - server persist
    - rollback on failure
  - `createBrowserSettingStore(...)`
  - `createMemorySettingStore(...)`
  - `resolveSettingInitialValue(...)`
  - `createSettingUpdateGate(...)` (duplicate in-flight guard utility)

### API helper

- `src/lib/settings/settings-api.ts`
  - `fetchSettingsSnapshot(...)`
  - `createPersistServerSetting(...)`

### Row hook

- `src/lib/settings/use-setting-row-mutation.ts`
  - `useSettingRowMutation(...)`
  - Exposes:
    - `value`
    - `pending`
    - `error`
    - `notice`
    - `commit(nextValue)`
  - Implements:
    - optimistic update
    - rollback on error
    - row-level pending lock
    - inline notice lifecycle

### Demo route (applied)

- `src/app/settings/save-policy/page.tsx`
  - ToggleRow and ValueRow both use `useSettingRowMutation`
  - “Fail Next Save” switch forces next request failure
  - Confirms row-level disable + rollback messaging
- `src/app/api/settings/route.ts`
  - Demo persistence endpoint with optional failure simulation

## 3) Failure Scenario Tests

Test file:
- `src/lib/settings/update-setting.test.ts`

Scenarios:
1. `resolveSettingInitialValue` prefers local cache over server/fallback
2. Successful optimistic save keeps committed value
3. Server failure rolls back UI and cache to previous value
4. In-flight duplicate update for the same key is ignored

Run command:
- `pnpm --dir web run test:settings:policy`

Expected:
- All tests pass
- Rollback and duplicate-guard behaviors are validated without UI dependency

