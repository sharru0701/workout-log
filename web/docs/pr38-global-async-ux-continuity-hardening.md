# PR 38 - Global Async UX Continuity Hardening

## Goal
- 데이터 조회 전후 UI 깜빡임(Empty/Disabled의 조기 노출, 지연 로드 구간의 플래시)을 추가로 줄여 전 화면 비동기 UX 흐름을 더 안정화한다.

## Self Prompt
- "로딩-완료 전환 시점에서 EmptyState가 먼저 보이는 모든 경로를 찾아, 쿼리 settled 이후에만 empty를 노출하도록 고친다. 공통 컴포넌트에는 짧은 안정화 지연을 넣어 순간 플래시를 흡수한다. 화면별 조건 분기는 최소 변경으로 유지하되, 사용자 인지상 깜빡임이 남는 주요 화면(plans/templates/stats/workout)에 우선 적용한다."

## Applied Scope
- 공통 상태 컴포넌트:
  - `EmptyStateRows`에 `revealDelayMs` 기반 안정화 지연 추가.
  - 네트워크 busy defer + reveal delay의 2단계 게이트로 순간 empty 플래시 억제.

- 화면별 settled gating 확장:
  - `plans/manage`:
    - templates/plans 로드 키 분리 + settled 기반 empty/disabled 노출.
    - 초기 로딩 중 "선택된 플랜 없음" 안내 조기 노출 방지.
  - `templates/manage`:
    - templates/versions 로드 키 분리 + settled 기반 empty 노출.
    - 편집기/버전 empty 상태를 데이터 조회 완료 이후로 지연.
  - `stats/dashboard`:
    - core/details/migration 쿼리별 settled 키 추가.
    - UX 퍼널/비교/시계열/운동별 분해/PR/준수율/마이그레이션 empty 상태를 settled 기반으로 통일.
    - `SparklineChart` 내부 즉시 empty 렌더를 제거하고 상위 settled 분기에서 제어.
  - `workout/today/log`:
    - 초기 플랜 로드 완료 전 "플랜 미선택" 경고 노출 방지.
  - `workout/session/[logId]`:
    - 초기 로딩 표시 타이밍 보정(초기 loading true + 짧은 delay).

## Expected UX Impact
- 탭 전환 직후/필터 변경 직후/비동기 지연 구간에서 empty 박스가 먼저 튀는 현상 감소.
- 조회 완료 후에만 empty가 보여 “데이터 없음”의 의미가 명확해짐.
- 빠른 상태 왕복 시 깜빡임(틱틱거림) 체감 최소화.
