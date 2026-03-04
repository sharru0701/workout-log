# PR 41 - Stats 1RM Async UX Regression

## Goal
- `stats-1rm` 화면에서 필터 전환/옵션 로딩 시 발생할 수 있는 empty-state 플래시 회귀를 자동 검증으로 고정한다.

## Self Prompt
- "stats-1rm의 실제 사용자 흐름(초기 진입, 기간 필터 변경, 옵션 미존재)을 Playwright로 재현한다.  
지연 응답을 강제한 상태에서 empty-state가 조기 노출되지 않음을 검증하고,  
필터 전환 후에도 화면이 깜빡임 없이 연속적으로 유지되는지 회귀 테스트를 만든다."

## Applied Scope
- 신규 회귀 스펙:
  - `e2e/stats-1rm-async-continuity.spec.ts`
  - 검증 시나리오:
    - 지연 응답 중 empty-state 비노출 + 기간 필터 전환(90일→30일) 시 연속성 유지
    - 옵션(exercises/plans) 비어있는 경우에도 settled 이전에는 "운동종목이 없습니다" 비노출
  - 안정성 장치:
    - `serviceWorkers: "block"`
    - `context.route("**/api/**")` 중앙 모킹 + 미모킹 API 즉시 실패
    - endpoint hit assertion

- 실행 스크립트:
  - `test:async-ux:stats-1rm`

## Validation
- `pnpm --dir web lint`
- `pnpm --dir web test:async-ux:stats-1rm`
