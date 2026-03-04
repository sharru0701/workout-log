# PR 40 - Global Async UX Continuity Completion

## Goal
- 비동기 데이터 로딩에서 발생하는 빈 상태 플래시 회귀를 테스트로 고정하고,
- 남은 화면(`stats-1rm`)의 settled gating을 공통 패턴으로 통일해 전역 흐름을 더 안정화한다.

## Self Prompt
- "서비스워커/브라우저 캐시 경로까지 고려해 Playwright API 모킹을 신뢰 가능한 방식으로 재구성한다.  
주요 화면(plans/templates/stats)의 empty-state 플래시를 회귀 테스트로 고정한다.  
남아있는 수동 settled 처리 화면(stats-1rm)은 공통 `useQuerySettled`로 통일하고,  
공통 설정 조회(`/api/settings`)는 SWR 기본 경로를 사용해 초기 재진입 체감 깜빡임을 줄인다."

## Applied Scope
- `e2e/async-ux-continuity.spec.ts`
  - `serviceWorkers: "block"` 적용.
  - `context.route("**/api/**")` 기반 중앙 API 라우터 도입.
  - 미모킹 API 즉시 실패 처리(회귀 조기 감지).
  - 화면별(mock plans/templates/stats) hit assertion 추가.
  - 엄격 셀렉터(strict mode) 충돌 없는 검증 셀렉터로 보정.

- `src/app/stats-1rm/page.tsx`
  - 수동 settled 키 관리 제거.
  - `useQuerySettled` 기반으로 옵션 조회/데이터 조회 settled gating 통일.
  - 옵션 시트 empty 문구를 settled 이후에만 노출하도록 조정.

- `src/lib/settings/settings-api.ts`
  - `fetchSettingsSnapshot`에서 강제 `network-only` 제거.
  - 공통 `apiGet` SWR 기본 경로를 사용하도록 변경.

## Validation
- `pnpm --dir web lint`
- `pnpm --dir web test:async-ux:continuity`
