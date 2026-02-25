# PR14 Settings Search

Date: 2026-02-25  
Objective: iOS Settings 패턴의 루트 검색을 제공하고, 검색 결과를 상세 설정 화면으로 딥링크 이동한다.

## 1) 설정 인덱스 정의

- Index file: `src/lib/settings/settings-search-index.ts`
- Shape:
  - `key`: 고유 검색 키
  - `title`: 검색 결과 Row 제목
  - `path`: 딥링크 경로
  - `section`: 결과 그룹(훈련/프로그램/분석/시스템)
  - `keywords`: 검색 키워드
  - `description`: 보조 설명

대표 항목
- `plans.context.timezone` → `/plans/context/select/timezone`
- `calendar.options.timezone` → `/calendar/options/select/timezone`
- `stats.filters.metrics` → `/stats/filters/select/metrics`
- `settings.save-policy` → `/settings/save-policy`
- `offline.help` → `/offline`

## 2) 검색 UI + 라우팅 구현

- Root top search bar: `/` 상단에 검색 바 추가
  - file: `src/components/ui/settings-search-panel.tsx`
  - styles: `src/components/ui/settings-search.module.css`
- 검색 로직:
  - file: `src/lib/settings/settings-search.ts`
  - 토큰 분리 + title/keywords/path 기반 스코어 정렬
- 결과 노출:
  - `NavigationRow`로 렌더링
  - 탭 시 `href=path` 딥링크 이동
- 하이라이트:
  - query token을 `mark`로 강조 표시
- No result:
  - `InfoRow`로 `검색 결과 없음` 안내

## 3) 대표 검색 시나리오 테스트

- test file: `src/lib/settings/settings-search.test.ts`

시나리오
1. `시간대` 검색
- 기대: `plans.context.timezone`, `calendar.options.timezone` 포함
2. `오프라인` 검색
- 기대: 최상위 결과 `offline.help`
3. 공백 정리 토큰화
- 입력: `  플랜   생성  ` → `['플랜', '생성']`
4. 매칭 없음
- 입력: `unmatchable-query-123` → 결과 0건
