# PR35 Minimal Copy Pass

Date: 2026-03-04
Goal: 전 화면에서 보조 설명 문구를 기본 비노출로 정리하고, 핵심 액션/값 중심으로 정보 밀도를 단순화한다.

## Self Prompt

```text
당신은 제품 UI 정리 담당 엔지니어다.
"화면 산만함 제거"를 목표로 아래 기준을 지켜라.

1) 모든 화면에서 보조 카피(서브타이틀, 설명, 풋노트, 보조 안내 문장)를 기본적으로 숨긴다.
2) 에러/상태 메시지는 사라지면 안 되므로 핵심 문구는 행 제목(label)로 승격해 유지한다.
3) 공통 컴포넌트 우선으로 일괄 적용하고, 공통 컴포넌트를 쓰지 않는 대형 화면은 수동으로 정리한다.
4) 입력/실행/결과에 직접 필요한 정보만 남긴다.
5) 린트 통과로 회귀 여부를 확인한다.
```

## PR Units Executed

### PR35-A Global Minimal Copy Mode
- Added [minimal-copy.ts](/home/dhshin/projects/workout-log/web/src/lib/ui/minimal-copy.ts).
- Updated shared components:
  - [settings-list.tsx](/home/dhshin/projects/workout-log/web/src/components/ui/settings-list.tsx)
  - [settings-state.tsx](/home/dhshin/projects/workout-log/web/src/components/ui/settings-state.tsx)
  - [accordion-section.tsx](/home/dhshin/projects/workout-log/web/src/components/ui/accordion-section.tsx)
  - [bottom-sheet.tsx](/home/dhshin/projects/workout-log/web/src/components/ui/bottom-sheet.tsx)
- Result:
  - Section description / footnote / row subtitle / row description 기본 비노출
  - BottomSheet / Accordion 보조 설명 기본 비노출
  - 상태 메시지는 label 중심으로 유지

### PR35-B High-Density Screen Cleanup
- Reduced custom helper copy on high-density pages:
  - [page.tsx](/home/dhshin/projects/workout-log/web/src/app/error.tsx)
  - [page.tsx](/home/dhshin/projects/workout-log/web/src/app/program-store/page.tsx)
  - [page.tsx](/home/dhshin/projects/workout-log/web/src/app/workout-record/page.tsx)
  - [page.tsx](/home/dhshin/projects/workout-log/web/src/app/workout/today/log/page.tsx)
  - [page.tsx](/home/dhshin/projects/workout-log/web/src/app/plans/manage/page.tsx)
  - [page.tsx](/home/dhshin/projects/workout-log/web/src/app/calendar/manage/page.tsx)
  - [page.tsx](/home/dhshin/projects/workout-log/web/src/app/stats/dashboard/page.tsx)
  - [page.tsx](/home/dhshin/projects/workout-log/web/src/app/stats-1rm/page.tsx)

### PR35-C Verification
- Command:
  - `pnpm --dir /home/dhshin/projects/workout-log/web lint`
- Result:
  - `eslint` passed (0 errors)

