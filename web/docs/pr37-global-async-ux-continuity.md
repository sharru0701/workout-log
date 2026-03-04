# PR37 - Global Async UX Continuity (SWR Cache Layer)

## Self Prompt
```
Goal:
- Minimize perceived flicker/jank during route changes and async data rendering in a Next.js client-heavy app.
- Apply one global technique with high impact and low migration risk.

Plan:
1) Compare web-standard approaches (Suspense/Transition, query cache libraries, stale-while-revalidate).
2) Select the best fit for the current codebase structure.
3) Implement in one PR with global reach.
4) Keep API compatibility for existing callers.
5) Verify with lint.
```

## Methods Reviewed
1. React Suspense + Transition boundaries.
2. Dedicated server-state library (SWR / TanStack Query) with keep previous data.
3. Global stale-while-revalidate cache + request deduplication in shared API layer.

## Chosen Method
`3) Shared API-layer SWR cache + in-flight dedupe`

Why this was chosen:
- Works across many existing screens immediately because they already use `apiGet`.
- Minimal migration cost (no full refactor to new hooks required).
- Directly targets flicker source: repeated loading states and empty-state flashes on quick re-entry/refetch.

## Scope
- Updated `web/src/lib/api.ts`:
  - `apiGet` now supports SWR-style cache behavior by default.
  - Added request dedupe to avoid duplicate parallel GETs.
  - Added bounded in-memory cache (LRU-like trimming).
  - Added `apiInvalidateCache()` helper.
  - Added API network inflight subscription (`subscribeApiNetworkInflight`) for UI gating.
  - Added `apiPost/apiPut/apiPatch/apiDelete` unified mutation helpers.
  - All mutation helpers invalidate cache after success.
- Added shared UI hooks:
  - `web/src/lib/ui/use-api-network-busy.ts`
  - `web/src/lib/ui/use-query-settled.ts`
- Updated `web/src/components/ui/settings-state.tsx`:
  - `EmptyStateRows` now defers rendering while API requests are actively in-flight (bounded defer).
- Migrated remaining JSON API direct `fetch` calls to shared API layer:
  - `web/src/app/program-store/page.tsx`
  - `web/src/components/exercise-catalog/exercise-catalog-content.tsx`
  - `web/src/lib/settings/settings-api.ts`
  - `web/src/lib/offlineLogQueue.ts`
  - `web/src/app/stats/dashboard/page.tsx` (migration telemetry read)
- Applied query-settled empty-state guard in dynamic screens:
  - `web/src/app/program-store/page.tsx`
  - `web/src/components/exercise-catalog/exercise-catalog-content.tsx`
  - `web/src/app/workout-record/page.tsx`
  - `web/src/app/settings/minimum-plate/page.tsx`
  - `web/src/app/calendar/manage/page.tsx`

## Expected UX Effect
- Re-entering a screen commonly reuses warm data immediately, reducing loading flashes.
- Rapid repeated navigations/refetches avoid duplicate network requests and layout thrash.
- Data freshness is still maintained via background revalidation.
- Empty-state rows are no longer eager-rendered while network requests are still resolving.

## Validation
- `pnpm --dir web lint` passed.
