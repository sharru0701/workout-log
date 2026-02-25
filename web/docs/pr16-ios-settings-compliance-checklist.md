# iOS Settings Compliance Checklist (PR16)

Date: 2026-02-25  
Scope: `web` 앱의 iOS Settings 패턴 준수 여부를 자동/반자동으로 검증

## 1) Quality Gate Commands

- 사전 준비(로컬): `pnpm --dir web exec playwright install --with-deps chromium`
- 전체 게이트: `pnpm --dir web run test:settings:compliance`
- 구조/간격/타이포/터치: `pnpm --dir web run test:settings:compliance:structure`
- 접근성(axe): `pnpm --dir web run test:settings:compliance:a11y`
- 시각 캡처(기본): `pnpm --dir web run test:settings:compliance:visual`
- 시각 회귀(엄격): `pnpm --dir web run test:settings:compliance:visual:strict`
- 시각 기준선 갱신: `pnpm --dir web run test:settings:compliance:visual:update`
- 색상 대비 토큰 점검: `pnpm --dir web run test:a11y:contrast`

## 2) 자동 점검 기준

### Spacing
- `section` 간 간격: 최소 `8px`
- Row 좌우 패딩: 최소 `12px` (목표값 16px)

### Typography
- 본문 기본 크기: 최소 `14px`
- `type-title` > 본문
- `type-caption`은 `12px` 이상, 타이틀보다 작아야 함

### Color
- Primary/Secondary 텍스트 색상은 동일하지 않아야 함
- 화면 배경색은 투명값 금지
- `--accent-primary` 토큰 존재 필수
- 상세 대비 비율은 `scripts/a11y-contrast-check.mjs`로 별도 검증

### Touch Target
- `[data-settings-touch-target]`의 높이 최소 `44px`

### State
- `/settings/state-samples`에서 `Loading/Empty/Error/Disabled/Notice` 행 패턴이 모두 동작해야 함

## 3) 화면별 체크리스트 매트릭스

기호: `A=자동`, `S=반자동(상호작용 포함)`, `N/A=해당 없음`

| Screen | Route | Spacing | Typography | Color | Touch | State | Visual | A11y |
|---|---|---|---|---|---|---|---|---|
| 루트 | `/` | A | A | A | A | N/A | A | A |
| 오늘 운동 | `/workout/today` | A | A | A | A | N/A | - | - |
| 캘린더 | `/calendar` | A | A | A | A | N/A | - | - |
| 캘린더 옵션 | `/calendar/options` | A | A | A | A | N/A | - | A |
| 플랜 | `/plans` | A | A | A | A | N/A | - | - |
| 플랜 만들기 | `/plans/create` | A | A | A | A | N/A | - | - |
| 생성 컨텍스트 | `/plans/context` | A | A | A | A | N/A | - | A |
| 통계 | `/stats` | A | A | A | A | N/A | - | - |
| 통계 필터 | `/stats/filters` | A | A | A | A | N/A | - | A |
| 템플릿 | `/templates` | A | A | A | A | N/A | - | - |
| 오프라인 도움말 | `/offline` | A | A | A | A | N/A | - | - |
| 설정 | `/settings` | A | A | A | A | N/A | A | A |
| 데이터 내보내기 | `/settings/data` | A | A | A | A | N/A | A | A |
| 저장 정책 | `/settings/save-policy` | A | A | A | A | S | - | A |
| 상태 샘플 | `/settings/state-samples` | A | A | A | A | S | A | A |
| 선택 템플릿 | `/settings/selection-template` | A | A | A | A | N/A | - | A |
| 잘못된 딥링크 안내 | `/settings/link/settings.unknown` | A | A | A | A | N/A | A | A |

## 4) 시각 회귀 기준선

- 테스트 파일: `e2e/ios-settings-visual.spec.ts`
- 기본 모드: 캡처만 수행(artifact 첨부), 렌더링 실패/빈 화면 방지
- 엄격 모드(`IOS_SETTINGS_VISUAL_STRICT=1`): 스냅샷 비교 활성화
- 엄격 모드 기준선 경로: `e2e/ios-settings-visual.spec.ts-snapshots/`
- 대상 화면: `/`, `/settings`, `/settings/data`, `/settings/state-samples`, `/settings/link/settings.unknown`
- 모드: Light + Dark

## 5) 접근성 자동 점검 규칙

- 도구: `@axe-core/playwright`
- 규칙 세트: `wcag2a`, `wcag2aa`
- 제외 규칙: `color-contrast`
  - 이유: 토큰 기반 대비 스크립트(`test:a11y:contrast`)로 별도 게이트 적용

## 6) 반자동 확인 항목 (릴리즈 전)

- Dynamic Type 환경에서 줄바꿈/잘림 점검 (작은 글씨/큰 글씨)
- Light/Dark 모드에서 주요 플로우 1회 수동 탐색
- Search → Deep Link → Target Row 이동 체감 확인
- 저장 실패 롤백 문구의 행동 유도 문장 확인
