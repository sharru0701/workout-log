# 성능 최우선 재구축 실행 계획

## 문서 목적

이 문서는 현재 `workout-log` 프로젝트를 실제로 재구축하기 위한 실행 기준 문서다.

전제는 다음과 같다.

- 이 앱은 운영 중인 프로덕션 앱이 아니라 개발 중인 앱이다.
- 성능 개선이 최우선 목표다.
- 현재 구조가 성능에 불리하다고 판단되면 대규모 재구축을 허용한다.
- 다만 최종 결과 기준으로 핵심 기능은 유지되어야 한다.
- 이 문서는 이후 실제 구현, 검증, 정리, 최종 PR 생성까지 이어질 계획이어야 한다.

---

## 현재 프로젝트 구조 분석

### 1. 기술 스택과 기본 성격

- 활성 제품은 루트가 아니라 `web` 앱 중심이다.
- 프레임워크는 `Next.js 16.1.6`, `React 19.2.3`, `App Router`, `Drizzle`, `Tailwind 4`, `Zustand 5` 조합이다.
- `reactCompiler`가 production 빌드에서만 활성화되어 있다.
- 일부 페이지는 이미 Server Component / SSR prefetch 패턴을 잘 사용하고 있다.
- 반면 몇몇 핵심 화면은 여전히 매우 큰 Client Component 중심으로 유지되고 있다.

### 2. 현재 구조의 강점

- `src/app/page.tsx`, `src/app/workout/log/page.tsx`, `src/app/calendar/page.tsx`, `src/app/stats/page.tsx`는 초기 데이터 일부를 서버에서 미리 가져오는 흐름이 이미 들어가 있다.
- `src/lib/api.ts`에는 캐시, dedupe, 네트워크 상태 추적, 오프라인 큐 인프라가 존재한다.
- `src/server/program-engine/generateSession.ts`, `src/lib/workout-record/model.ts`, `src/lib/program-store/model.ts`처럼 재사용 가능한 순수 로직과 도메인 로직이 이미 있다.
- 즉, 이 프로젝트는 완전히 빈 상태가 아니라 “좋은 서버/도메인 자산 + 무거운 화면 계층”이 섞여 있는 상태다.

### 3. 현재 구조의 주요 병목 후보

현재 코드베이스에서 크기와 역할 기준으로 가장 먼저 손대야 하는 구간은 다음과 같다.

- `web/src/app/workout/log/_components/workout-log-client.tsx` 약 2954줄
- `web/src/app/program-store/page.tsx` 약 2084줄
- `web/src/app/calendar/_components/calendar-client.tsx` 약 1434줄
- `web/src/app/stats/_components/stats-1rm-detailed.tsx` 약 876줄

이 파일들의 공통 문제는 다음과 같다.

- 데이터 로드, URL 상태, sheet 제어, 폼 상태, mutation, 렌더링이 한 파일에 섞여 있다.
- 화면 단위 state 범위가 너무 넓어서 작은 상호작용도 큰 리렌더로 번질 가능성이 높다.
- route-level code splitting은 일부 되어 있지만, screen-level orchestration이 과도하게 뭉쳐 있다.
- 재사용 가능한 행 단위 / 섹션 단위 / feature 단위 경계가 약하다.

### 4. 구조적 문제

성능 관점에서 특히 중요한 구조 문제는 아래와 같다.

- `workout` 도메인에 구형/신형 흐름이 공존한다.
- `/workout/log`와 별도로 `/workout/[sessionId]`, `/workout/today`, `/workout/session/[logId]`가 존재한다.
- `workout` 관련 상태모델이 `workout-record` 계열과 `Zustand` 계열로 이원화되어 있다.
- `app` 레이어, `components`, `lib`, `server` 사이에 도메인 책임이 화면 단위로 섞여 있다.
- 화면별로 최적화 방식이 제각각이라 공통 성능 전략을 적용하기 어렵다.

### 5. 현재 구조에 대한 결론

이 프로젝트는 미세 최적화만으로 해결할 단계가 아니다.

- 병목은 주로 큰 화면 컴포넌트와 넓은 상태 범위에서 나온다.
- 반대로 서버/도메인 계층은 버리기보다 재사용할 가치가 높다.
- `Home` 화면은 이미 server-first 성격이 강하므로 이번 재구축의 1차 우선순위는 아니다.
- 따라서 가장 효율적인 전략은 “전체 앱을 무조건 한 번에 FSD로 이동”이 아니라, “핵심 화면을 새 구조로 재구축하고 legacy를 단계적으로 제거”하는 방식이다.

---

## 이번 작업의 핵심 판단

### 1. 화면 단위 재구축이 우선이다

이번 프로젝트의 성능 개선 핵심은 폴더명 변경이 아니라 다음이다.

- 초기 로드 경량화
- 입력 반응성 개선
- 저장 시 체감 지연 제거
- 긴 화면에서의 리렌더 범위 축소
- 중복 라우트와 중복 상태모델 제거

### 2. FSD는 수단으로만 사용한다

새 구조는 FSD에 가까운 계층 분리를 사용하되, 성능 목표를 달성하기 위한 실용적 적용만 한다.

- `src/app`: 라우팅과 서버 조립
- `src/server`: DB, 서비스, 쿼리, 생성 엔진, mutation entry
- `src/shared`: 공용 UI, hooks, util, fetch client
- `src/entities`: 도메인 타입, 순수 변환, selector
- `src/features`: 사용자 액션 단위 기능
- `src/widgets`: 화면 조립 단위
- `src/legacy`: 이관 전 기존 화면

### 3. Server Actions 전면 도입은 이번 계획의 중심이 아니다

최신 기술을 쓰는 것보다 실제 성능 개선이 중요하다.

- 읽기 경로는 RSC/SSR 우선 유지
- mutation 경로는 기존 `route.ts` + thin client layer를 기본으로 사용
- Server Actions는 “실제로 이득이 큰 좁은 구간”에서만 선택적으로 사용
- 오프라인/드래프트/복구 흐름과 충돌하는 전면 Server Actions 전환은 이번 1차 목표가 아니다

### 4. 새로운 상태 라이브러리는 기본 선택이 아니다

지금 단계에서 `Jotai`, `Nanostores`, `TanStack Query` 같은 신규 핵심 의존성을 먼저 들이는 것은 우선순위가 아니다.

- 우선은 상태 범위를 줄이고 화면을 분해하는 것이 더 큰 효과를 낸다.
- 신규 라이브러리 도입은 Phase 0 측정 후 명확한 이득이 보일 때만 검토한다.

---

## 목표 성능 기준

정확한 수치는 Phase 0에서 baseline 측정 후 확정한다. 다만 이번 재구축의 목표 방향은 명확히 고정한다.

- `workout/log` 초기 진입 시 route-level JS 부담을 의미 있게 줄인다.
- 행 단위 입력, 세트 수정, 검색 입력, sheet open/close 시 전체 화면 리렌더를 피한다.
- 저장 동작은 전역 blocking UI 대신 로컬 pending 상태 중심으로 바꾼다.
- 검색 및 필터링은 긴 리스트에서도 끊김 없이 동작하도록 만든다.
- `/workout` 도메인의 중복 라우트와 중복 상태모델을 정리한다.
- 재구축이 끝난 뒤에도 build, typecheck, 핵심 E2E가 안정적으로 통과해야 한다.

---

## 재사용할 것과 버릴 것

### 재사용 우선 대상

- `src/server/program-engine/*`
- `src/server/progression/*`
- `src/server/stats/*`
- `src/lib/workout-record/model.ts`
- `src/lib/program-store/model.ts`
- `src/lib/settings/*`
- `src/lib/session-key.ts`
- DB schema, migration, seed 체계

이 자산들은 화면이 아니라 도메인 규칙과 서버 처리에 가깝기 때문에 재구축 시 최대한 살린다.

### 적극 재구축 대상

- `src/app/workout/log/_components/workout-log-client.tsx`
- `src/app/program-store/page.tsx`
- `src/app/calendar/_components/calendar-client.tsx`
- `src/app/stats/_components/stats-1rm-detailed.tsx`
- `src/app/workout/[sessionId]/page.tsx`
- `src/store/workoutStore.ts`
- `src/lib/workout/useWorkoutPersistence.ts`

### 정리 대상

- 중복되는 workout 진입 경로
- 화면 안에 섞여 있는 URL 상태 해석, fetch orchestration, sheet 제어 코드
- 화면 레벨에서 너무 많은 역할을 동시에 수행하는 giant component

---

## 타깃 아키텍처

이번 재구축의 목표 구조는 다음과 같다.

```text
src/
  app/
    ...route files only
  server/
    auth/
    db/
    services/
    program-engine/
    progression/
    stats/
  shared/
    ui/
    lib/
    hooks/
    api/
  entities/
    workout/
    plan/
    program/
    exercise/
    stats/
    settings/
  features/
    workout-log/
    exercise-picker/
    plan-start/
    program-editor/
    calendar-navigation/
    stats-filters/
  widgets/
    workout-log-screen/
    program-store-screen/
    calendar-screen/
    stats-screen/
  legacy/
    workout/
    program-store/
```

핵심 원칙은 아래와 같다.

- 페이지는 조립만 한다.
- 도메인 규칙은 화면 밖으로 뺀다.
- sheet, dialog, picker, list row는 feature 단위로 쪼갠다.
- 서버 읽기와 클라이언트 쓰기를 명확히 분리한다.
- legacy를 한 번에 지우지 않고 새 구조가 완성될 때까지 격리한다.

---

## 실행 단계

### Phase 0. 기준선 측정 및 구조 인벤토리

목표는 “무엇이 느린지”를 추측이 아니라 데이터로 고정하는 것이다.

작업:

- `workout/log`, `program-store`, `calendar`, `stats`의 현재 network waterfall 기록
- route별 초기 JS 크기와 chunk 구성 확인
- React DevTools Profiler 기준으로 주요 상호작용 리렌더 범위 기록
- 가장 무거운 컴포넌트와 state ownership 지도 작성
- legacy route와 신규 route의 기능 겹침 표 작성

산출물:

- baseline 문서
- 우선순위별 화면 목록
- keep / rewrite / delete 대상 목록 확정

완료 기준:

- 이후 모든 성능 주장이 baseline 비교로 설명 가능해야 한다

### Phase 1. 새 구조 골격 도입

목표는 실제 화면 이관 전에 새 구조를 수용할 발판을 만드는 것이다.

작업:

- `shared`, `entities`, `features`, `widgets`, `legacy` 디렉터리 도입
- 순수 도메인 함수와 타입을 새 계층으로 이동 또는 재export
- `app` 레이어에서 직접 많은 로직을 들고 있지 않도록 규칙 정리
- 공용 fetch/mutation 호출 규약 정리
- 화면별 state 설계 원칙 정리

원칙:

- 이 단계에서는 큰 화면을 억지로 다 옮기지 않는다
- 구조만 만들고 실제 hot path는 다음 phase에서 옮긴다

완료 기준:

- 이후 새 화면은 기존 `components` / `lib` 혼합 구조가 아니라 새 계층에 쌓을 수 있어야 한다

### Phase 2. Workout Log V2 재구축

가장 중요한 단계다. 이번 재구축의 중심은 `workout/log`다.

작업:

- `workout-log-client.tsx`를 화면 오케스트레이터 + feature/widget 단위로 해체
- 드래프트 복구, 세트 편집, 운동 추가, 플랜 선택, 저장 로직을 분리
- row 단위 렌더링과 편집 상태 범위를 최소화
- URL 상태 해석과 데이터 로딩 orchestration을 화면 렌더 코드와 분리
- 저장 시 전역 스피너 대신 부분 pending/optimistic 흐름으로 재설계
- `workout` legacy route와 공유해야 하는 로직은 entities/features로 흡수

이 단계에서 함께 정리할 것:

- `/workout/[sessionId]` 흐름의 존재 이유 재평가
- `Zustand` 기반 workout 세션 구조와 `workout-record` 구조의 중복 제거
- 드래프트 persistence와 세션 persistence 통합 방향 결정

완료 기준:

- `workout/log`가 더 이상 giant screen component에 의존하지 않는다
- 세트 수정/추가/저장/복구가 분리된 feature 단위로 동작한다
- 기존 기능 parity가 맞고 체감 성능이 baseline 대비 개선된다

### Phase 3. Program Store V2 재구축

`program-store`는 현재 두 번째 대형 병목이다.

작업:

- `program-store/page.tsx`를 catalog, detail, customize, start-flow로 분리
- 프로그램 목록 렌더와 편집 흐름을 분리
- exercise editor row와 drag/reorder state 범위를 축소
- OneRM 추천, 템플릿 포크, 생성 흐름을 기능 단위로 분리
- 화면 진입 초기 로드와 상세 시트 로드를 나눠 초기 비용을 줄인다

완료 기준:

- 프로그램 스토어의 초기 진입과 편집 반응성이 baseline 대비 개선된다
- 새로운 계획/시작 흐름이 `workout/log` V2와 자연스럽게 연결된다

### Phase 4. Calendar / Stats 정리 및 공통 패턴 통합

이 단계는 재구축 범위를 앱 전반으로 확장하는 단계다.

작업:

- `calendar-client.tsx`를 월 탐색, 날짜 상세, 로그 미리보기, 세션 미리보기 단위로 분리
- `stats-1rm-detailed.tsx`를 필터, 차트, 요약, 비교 섹션 단위로 분리
- 공통 picker / filter / lazy section 패턴을 shared/features 계층으로 통합
- 화면별 query state 처리 방식 일원화

완료 기준:

- calendar와 stats도 giant screen component에서 벗어난다
- 공통 상호작용 패턴이 재사용 가능한 단위로 정리된다

### Phase 5. Legacy 제거 및 최종 성능 정리

새 구조가 안정화되면 남은 부채를 정리한다.

작업:

- `/workout/[sessionId]`, `workoutStore`, 구형 persistence 흐름 제거 또는 redirect
- 새 구조에서 더 이상 쓰지 않는 old component/lib 삭제
- import 경로 정리
- dead code 제거
- 주석과 문서 업데이트
- 최종 PR 정리

완료 기준:

- route duplication이 사라진다
- 동일 도메인에 중복 상태모델이 남아 있지 않다
- legacy 없이 새 구조만으로 핵심 기능이 동작한다

---

## 구현 원칙

이번 작업에서 반드시 지킬 원칙은 다음과 같다.

- 성능 개선과 구조 개선을 함께 하되, 성능 효과가 없는 폴더 이동만 먼저 하지 않는다.
- giant component를 분해할 때는 렌더 경계와 state ownership을 먼저 설계한다.
- 도메인 규칙은 가능하면 순수 함수로 유지하고 테스트 가능한 위치로 둔다.
- 읽기 경로는 서버 우선, 쓰기 경로는 얇고 예측 가능한 클라이언트 계층을 유지한다.
- `memo` 남발이나 임시 캐싱보다 state 범위 축소와 책임 분리를 우선한다.
- 신규 라이브러리 도입은 마지막 수단으로 둔다.
- 한 화면을 끝내기 전까지는 성능 개선과 기능 parity를 같이 본다.

---

## 이번 계획에서 하지 않을 것

- 시작부터 전 파일을 기계적으로 FSD로 이동하는 작업
- 측정 없이 `useMemo`, `useCallback`, `memo`를 무차별 추가하는 작업
- 오프라인/복구/드래프트 흐름을 무시한 전면 Server Actions 전환
- UI 레이아웃 재디자인을 성능 리팩터링보다 우선하는 작업
- 기능 겹침을 방치한 채 새 화면만 하나 더 만드는 작업

---

## 검증 계획

### 1. 정적 검증

- `pnpm --dir web run typecheck`
- `pnpm --dir web run lint`
- `pnpm --dir web run test:unit`
- 필요 시 관련 도메인 테스트 추가

### 2. 통합 검증

- `pnpm --dir web run test:e2e`
- `pnpm --dir web run test:async-ux:continuity`
- `pnpm --dir web run build`

### 3. 성능 검증

- route별 네트워크 요청 수 비교
- route별 client JS payload 비교
- 주요 상호작용 commit time 비교
- 세트 편집, 검색 입력, sheet open, 저장 시 UX 끊김 여부 확인
- `workout/log`, `program-store`, `calendar`, `stats` 각각에 대한 전/후 프로파일 비교

### 4. 수동 시나리오

- 프로그램 선택 후 `workout/log` 진입
- 기존 로그 열기
- 세트 수정 및 추가 운동 입력
- 저장 후 재진입
- 드래프트 복구
- 프로그램 생성/커스터마이징 후 운동 시작
- 캘린더에서 날짜 이동 및 로그/세션 미리보기
- 통계 필터 변경 및 상세 차트 열기

---

## 최종 완료 조건

이번 재구축은 아래 조건을 만족해야 완료로 본다.

- 핵심 기능은 유지된다
- `workout/log`와 `program-store`가 새 구조로 이관된다
- legacy workout 흐름 정리가 끝난다
- giant component 의존도가 크게 낮아진다
- 성능 baseline 대비 개선 근거를 제시할 수 있다
- 코드 구조가 이후 추가 작업에도 계속 확장 가능한 상태가 된다
- 모든 작업 완료 후 최종 PR을 생성할 수 있는 수준으로 정리된다

---

## 최종 실행 전략 요약

이번 작업은 “현재 구조 위에 최적화 패치를 덧붙이는 작업”이 아니다.

이번 작업은 다음 전략으로 진행한다.

- 좋은 서버/도메인 자산은 살린다
- 무거운 화면 계층은 새 구조로 재구축한다
- `workout/log`를 최우선으로 다시 만든다
- 그 다음 `program-store`, `calendar`, `stats` 순으로 정리한다
- 마지막에 legacy를 제거하고 전체 성능을 검증한다

즉, 이번 계획의 핵심은 전면 재구축을 허용하되, 실제 효과가 큰 화면부터 순서대로 갈아엎는 것이다.
