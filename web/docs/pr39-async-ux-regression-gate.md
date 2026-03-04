# PR 39 - Async UX Regression Gate

## Goal
- 깜빡임 회귀를 자동으로 탐지할 수 있도록 Playwright 기반 회귀 게이트를 추가한다.
- QA가 같은 기준으로 체감 점검할 수 있도록 체크리스트를 문서화한다.

## Self Prompt
- "지연된 API 응답 상황을 강제로 만들고, 데이터가 도착하기 전에 empty-state가 잠깐이라도 보이면 실패하도록 회귀 테스트를 작성한다. 주요 화면(plans/templates/stats)을 대상으로 하고, 수동 QA 체크리스트를 함께 남긴다."

## Changes
- 신규 Playwright 회귀 스펙 추가:
  - `e2e/async-ux-continuity.spec.ts`
  - API 응답 지연 + mock 데이터를 주입해 empty-state 플래시 회귀를 검증.
  - 대상 화면:
    - `/plans/manage`
    - `/templates/manage`
    - `/stats/dashboard`
- 신규 수동 점검 체크리스트 추가:
  - `docs/async-ux-continuity-checklist.md`
  - 탭 전환/초기 로드/지연 로드/워크아웃 컨텍스트를 시나리오로 정의.
- 테스트 스크립트 추가:
  - `test:async-ux:continuity`

## Expected Effect
- 비동기 로딩 UX가 깨졌을 때 CI/로컬에서 조기 탐지 가능.
- 체감 품질 검증 기준이 명확해져 반복 수정 시 회귀 위험을 줄임.
