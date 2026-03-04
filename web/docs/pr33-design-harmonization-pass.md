# PR33 Design Harmonization Pass

Date: 2026-03-04
Goal: 부모 화면과 모달 사이의 배경/보더/상태색 톤 차이를 줄이고, 전 화면에서 동일한 표면 계층(surfaces)을 사용하도록 통일.

## Self Prompt

```text
당신은 Workout Log 프론트엔드 디자인 시스템 리뷰어다.
목표는 "화면-모달 간 톤 불일치 제거 + 전체 화면 표면 계층 통일"이다.

규칙:
1) 공통 surface token을 먼저 정의하고, 화면/카드/모달/상태칩이 그 토큰만 사용하게 만든다.
2) 개별 페이지 수정보다 전역 오버라이드 레이어를 우선 적용한다.
3) 설정(parent) 화면과 상세(bottom sheet) 화면의 배경/패딩/너비 리듬을 맞춘다.
4) 기존 기능 로직은 바꾸지 않는다.
5) 변경 후 타입체크로 회귀를 검증한다.

출력:
- PR 단위로 변경 목적/적용 파일/검증 결과를 기록한다.
```

## PR Units Executed

### PR33-A Surface Token Unification
- Added final global token layer in `src/app/globals.css`.
- Introduced shared tokens for:
  - card surface
  - muted surface
  - border
  - sheet panel/backdrop
  - status backgrounds (neutral/success/warning/danger)
- Mapped frequently used utility classes (`bg-*`, `text-*`, `border-*`) to semantic tokens so all screens follow one palette.

### PR33-B Parent-Modal Visual Parity
- Updated settings parent/background and child modal relationship in `src/app/globals.css`.
- Adjusted:
  - background dim level for parent settings screen while modal open
  - settings child modal panel width to align with app shell width
  - settings modal content padding/gap to match screen rhythm
  - bottom sheet panel/backdrop/footer surfaces to the same tonal scale

### PR33-C Component-Level Cleanup
- Updated `src/components/ui/card.tsx`.
- Removed redundant `bg-white` utility forcing from `Card` component so card background always follows shared surface tokens.

## Validation
- `pnpm --dir web exec tsc --noEmit`
- `pnpm --dir web build`
