# PR34 Full-Screen Visual Audit Checklist

Date: 2026-03-04
Goal: 전 화면(코어/선택/피커/설정 모달)을 동일 기준으로 스크린샷 검수하고, 부모 화면과 모달 간 표면 톤 일치 여부를 자동 점검.

## Self Prompt

```text
당신은 UI QA 자동화 엔지니어다.
"모든 화면 검수"를 위해 아래 원칙을 지켜라.

1) 라우트 누락이 없도록 코어 화면 + 선택/피커 화면 + 설정 상세 모달 화면까지 타깃 목록을 명시한다.
2) 각 타깃은 light/dark 스킴에서 full-page 스크린샷을 캡처한다.
3) 시각 회귀 이전에 디자인 일관성 규칙을 자동 검사한다.
   - body/main surface가 transparent가 아닐 것
   - `.ui-card`와 `.bg-white`가 동시에 존재할 때 배경색이 사실상 동일할 것
   - 바텀시트 화면에서 panel/backdrop이 존재하고 표면색이 유효할 것
   - settings child modal 배경 opacity가 허용 범위에 있을 것
4) 실패 시 어떤 화면에서 규칙을 위반했는지 바로 찾을 수 있게 test 이름을 route id로 고정한다.
5) 실행 커맨드와 결과를 문서에 남긴다.
```

## PR Units Executed

### PR34-A Route Inventory
- Added [design-harmonization.targets.ts](/home/dhshin/projects/workout-log/web/e2e/design-harmonization.targets.ts) with full audit targets.
- Coverage:
  - Core pages (`/`, plans, calendar, stats, templates, workout, program-store, offline)
  - Selection/picker pages (`/plans/context/*`, `/stats/filters/*`, `/calendar/options/*`)
  - Settings modal pages (`/settings/*` child routes)
  - Deep-link routes (`/settings/link`, `/settings/link/[key]`)

### PR34-B Screenshot + Pixel Consistency Spec
- Added [design-harmonization.spec.ts](/home/dhshin/projects/workout-log/web/e2e/design-harmonization.spec.ts).
- Checks per target:
  - body/main background validity
  - `.ui-card` vs `.bg-white` background color distance
  - bottom sheet panel/backdrop validity
  - settings child modal background opacity range
- Captures full-page screenshots and attaches artifacts.
- Supports strict snapshot mode:
  - `DESIGN_HARMONIZATION_VISUAL_STRICT=1`

### PR34-C Command Surface
- Added package scripts in [package.json](/home/dhshin/projects/workout-log/web/package.json):
  - `test:design:harmonization`
  - `test:design:harmonization:strict`
  - `test:design:harmonization:light`
  - `test:design:harmonization:dark`

## Run Commands

```bash
pnpm --dir web run test:design:harmonization:light
pnpm --dir web run test:design:harmonization:dark
```

## Latest Run Result
- Executed on 2026-03-04 (Asia/Seoul):
  - `pnpm --dir /home/dhshin/projects/workout-log/web run test:design:harmonization:light`
    - Result: 56 passed, 0 failed
  - `pnpm --dir /home/dhshin/projects/workout-log/web run test:design:harmonization:dark`
    - Result: 56 passed, 0 failed
- Re-verified on same day with the same commands:
  - Result remained identical (`light: 56 passed`, `dark: 56 passed`)
- Note:
  - During run, several API `500` logs were observed in pages that require DB data.
  - These were environment/data availability issues and did not block this visual harmonization audit.
