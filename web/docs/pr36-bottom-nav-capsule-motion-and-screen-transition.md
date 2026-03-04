# PR36 Bottom Nav Capsule Motion + Screen Transition

Date: 2026-03-04
Goal: 하단 탭 활성 캡슐을 레퍼런스 톤으로 연하게 보정하고, 캡슐 이동 애니메이션 및 전 화면 전환 애니메이션을 공통 적용한다.

## Self Prompt

```text
당신은 모바일 UI 마감 엔지니어다.
"하단 탭 레퍼런스 정합 + 전 화면 모션 통일"을 목표로 아래를 수행한다.

1) 활성 탭 인디케이터는 언더라인이 아니라 iOS 스타일 캡슐 트랙으로 표현한다.
2) 활성 캡슐 색은 무채색 계열로 유지하되, 기존 대비 한 단계 연하게 보정한다.
3) 캡슐은 탭 전환 시 위치 이동 애니메이션(translate 기반)으로 자연스럽게 움직인다.
4) 화면 전환 애니메이션은 공통 클래스(native-page-enter)를 통해 모든 화면에 적용한다.
5) prefers-reduced-motion 환경에서는 애니메이션을 비활성화해 접근성을 유지한다.
6) 린트 통과로 회귀를 점검한다.
```

## PR Units Executed

### PR36-A Active Capsule Track + Motion
- Updated [bottom-nav.tsx](/home/dhshin/projects/workout-log/web/src/components/bottom-nav.tsx)
  - Added CSS variables for active index and tab count:
    - `--bottom-nav-active-index`
    - `--bottom-nav-tabs-count`
- Updated [globals.css](/home/dhshin/projects/workout-log/web/src/app/globals.css)
  - Introduced moving capsule on `.app-bottom-nav::before`
  - Active tab now uses text emphasis while capsule is rendered on nav track
  - Capsule motion uses transform transition with eased timing

### PR36-B Tone Tuning (Lighter Capsule)
- Added/adjusted theme tokens in [globals.css](/home/dhshin/projects/workout-log/web/src/app/globals.css):
  - `--bottom-nav-active-bg` (light/dark)
- Applied lighter neutral capsule tone:
  - Light: `#ececef`
  - Dark: `#343437`

### PR36-C Screen Transition (All Screens)
- Added global route-enter animation in [globals.css](/home/dhshin/projects/workout-log/web/src/app/globals.css):
  - `@keyframes ui-screen-route-in`
  - `.native-page-enter` animation override (global)
  - `.settings-child-modal-content .native-page-enter` animation override (settings child flows)
- Added reduced-motion fallback:
  - Disable capsule transition and route-enter animation when `prefers-reduced-motion: reduce`

## Verification

```bash
pnpm --dir /home/dhshin/projects/workout-log/web lint
```

Result:
- `eslint` passed (0 errors)

