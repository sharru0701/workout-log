# PR31 - Goal IA Navigation Skeleton

## 목적
- 목표 화면구조(A/B/C)를 변경 없이 1:1 라우팅 스켈레톤으로 강제.
- 공통 Header/Floating Tab을 앱 전역 컴포넌트로 적용.
- 모든 목표 화면을 placeholder라도 즉시 실행 가능한 상태로 연결.

## 화면 트리 / 라우팅 다이어그램 (텍스트)
```text
A. Global
├─ Header (Back / Title / Settings)
└─ Floating Tab (Home / Workout Record / Program Store / 1RM Stats)

B. Main
├─ Home                               -> /
├─ Workout Record                     -> /workout-record
│  ├─ + Add Exercise                  -> /workout-record/add-exercise
│  └─ Exercise CRUD                   -> /workout-record/exercise-catalog
├─ Program Store                      -> /program-store
│  ├─ Program Detail Modal            -> /program-store/detail?program={id}
│  ├─ Customization Modal             -> /program-store/customize?program={id}
│  └─ Create/Customize Modal          -> /program-store/create
└─ 1RM Stats / Graph                  -> /stats-1rm

C. Settings
├─ Settings root                      -> /settings
├─ Theme                              -> /settings/theme
├─ Minimum Plate / Increment          -> /settings/minimum-plate
├─ Bodyweight                         -> /settings/bodyweight
├─ Data Export                        -> /settings/data-export
├─ Offline Help                       -> /settings/offline-help
└─ App Info / About                   -> /settings/about
```

## 목표 화면구조 매핑 표
| 목표 ID | 목표 화면/기능 | Route | View File |
| --- | --- | --- | --- |
| A-0 | 공통 Header | Global | `src/components/top-back-button.tsx` |
| A-1 | 공통 Floating Tab | Global | `src/components/bottom-nav.tsx` |
| B-1 | Home | `/` | `src/app/page.tsx` |
| B-2 | Workout Record | `/workout-record` | `src/app/workout-record/page.tsx` |
| B-2-4-3 | + Add Exercise | `/workout-record/add-exercise` | `src/app/workout-record/add-exercise/page.tsx` |
| B-2-4-3 (CRUD) | Exercise CRUD | `/workout-record/exercise-catalog` | `src/app/workout-record/exercise-catalog/page.tsx` |
| B-3 | Program Store | `/program-store` | `src/app/program-store/page.tsx` |
| B-3-2 | Program Detail Modal | `/program-store/detail` | `src/app/program-store/detail/page.tsx` |
| B-3-2-2-1 | Customization Modal | `/program-store/customize` | `src/app/program-store/customize/page.tsx` |
| B-3-3-1 | Create/Customize Modal | `/program-store/create` | `src/app/program-store/create/page.tsx` |
| B-4 | 1RM Stats / Graph | `/stats-1rm` | `src/app/stats-1rm/page.tsx` |
| C | Settings root | `/settings` | `src/app/settings/page.tsx` |
| C-1 | Theme | `/settings/theme` | `src/app/settings/theme/page.tsx` |
| C-2 | Minimum Plate | `/settings/minimum-plate` | `src/app/settings/minimum-plate/page.tsx` |
| C-3 | Bodyweight | `/settings/bodyweight` | `src/app/settings/bodyweight/page.tsx` |
| C-4 | Data Export | `/settings/data-export` | `src/app/settings/data-export/page.tsx` |
| C-5 | Offline Help | `/settings/offline-help` | `src/app/settings/offline-help/page.tsx` |
| C-6 | App Info / About | `/settings/about` | `src/app/settings/about/page.tsx` |

## 구현 메모
- Back 버튼: `router.back()` 우선, 히스토리 없으면 `/` fallback.
- Settings 버튼: Header 우측 고정, 항상 `/settings`로 push.
- 터치 영역: Header/Tab 주요 탭 타깃은 `--touch-target(>=44px)` 기준 준수.
