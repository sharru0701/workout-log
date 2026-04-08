# 향상된 워크아웃 로그 앱 성능 개선 및 구조 혁신 (FSD & React 19 최적화)

사용자 경험(UX)과 성능을 저해하는 현 방식(거대한 모놀리식 클라이언트 컴포넌트, 비효율적 상태 관리, 구형 API 라우트 패턴)을 해결하기 위해 최신 기술과 리팩터링 방법론을 적용한 대대적인 앱 성능 개선 설계안입니다. 

## ⚠️ User Review Required

> [!WARNING]
> 본 계획은 **FSD(Feature-Sliced Design) 아키텍처 도입** 등 디렉터리 배치의 전면 개편을 포함합니다.
> 이로인해 대규모 파일 이동과 분리가 이뤄질 예정이며, 기능은 그대로 유지되나 코드의 위치와 패턴이 크게 달라집니다. 승인하시겠습니까?

## 설계 개요 및 목표

1. **아키텍처 혁신 (FSD 도입)**: `src` 하위의 모든 로직을 명확한 역할(App, Features, Entities, Shared 등)로 분리해 번들 크기를 최적화하고 코드 병목을 해소.
2. **거대 클라이언트 컴포넌트 해체**: 3000줄에 달하는 `workout-log-client.tsx`를 목적별 아주 작은 기능 단위 모듈로 분할 (Code Splitting & Lazy Loading).
3. **단위 상태 최적화 (Fine-grained State)**: 무거운 글로벌 Zustand 스토어나 Props Drilling 대신, 로컬 단위 컴포넌트에서만 리렌더링이 일어나도록 훅/상태 아키텍처 개편.
4. **React 19 & Server Actions 전면 도입**: REST API 호출 대신 서버 액션(Server Actions)과 `useOptimistic`, `useActionState`를 통해 로딩 화면 없는 즉각적인 UI 반응성(Zero-JS Optimistic Updates) 확보.

---

## Proposed Changes

### 1. FSD(Feature-Sliced Design) 기반 디렉터리 재구성
기존 `src/app`, `src/components`, `src/lib` 등에 혼재되어 있던 코드를 FSD 표준 구조로 리팩터링합니다.

#### [NEW] `src/shared/`
- **UI**: 디자인 시스템 (`components/ui` 이동 및 재구성)
- **API / Fetcher**: 서버 통신 모듈
- **Lib**: 날짜 처리, 무게 계산 포맷팅 같은 순수 유틸리티

#### [NEW] `src/entities/`
도메인 핵심 데이터 구조와 타입, 비즈니스 로직.
- **Workout**: 워크아웃 세션 도메인
- **Exercise**: 운동 종목 도메인 
- **Plan**: 운동 계획 도메인

#### [NEW] `src/features/`
사용자의 주요 행동(Action) 단위 모듈.
- **`workout-logging/`**: 세트 기록, 삭제, 스와이프 액션, 
- **`timer/`**: 타이머 기능
- **`exercise-selection/`**: 검색 및 종목 선택 시트

#### [MODIFY] `src/app/`
App Router 레이어는 오직 라우팅과 페이지 조립을 위한 역할만 수행하도록 축소.
- 기존 거대한 페이지 컴포넌트는 Features와 Entities에서 위젯을 조립하여 렌더링하는 형태로 단순화.

---

### 2. 거대 컴포넌트(`workout-log-client.tsx`)의 해체와 분할
약 3000줄 규모의 파일을 다음과 같이 쪼개고 지연 로딩(Lazy Loading) 및 React Compiler의 타겟에 맞게 최적화.

#### [DELETE] `src/app/workout/log/_components/workout-log-client.tsx`
#### [NEW] `src/features/workout-logging/ui/exercise-set-row.tsx`
#### [NEW] `src/features/workout-logging/ui/workout-log-board.tsx`
#### [NEW] `src/features/workout-logging/model/use-workout-log-state.ts`
- 복잡도 분산을 통해 `React Compiler`가 정확하게 Memoize(캐싱) 할 수 있는 구조를 형성.
- 앱 실행 시점에 한 번에 모든 JavaScript 코드가 로드되지 않게 Code Splitting 극대화.

---

### 3. Server Actions & Optimistic UI 도입
현재 클라이언트에서 API 통신 진행 시 발생하는 지연(Jank)과 스피너를 없앱니다.

#### [MODIFY] `src/server/db/` 관련 로직
- Next.js의 Server Actions 인 `useActionState` 및 폼 액션 적용.
- 운동 세트 완료를 누르자 마자 클라이언트 단에서 `useOptimistic` 훅을 통해 로딩없이 UI 우선 반영, 이후 서버 저장 처리 완료 구조 (반응성 200% 증가 체감).

---

## Open Questions

> [!IMPORTANT]
> - 현재 앱(운동 세트 기록 관련 등)에서 **상태 관리에 Jotai나 Nanostores 같은 원자(Atomic) 상태 관리 라이브러리를 추가 도입**할지, 아니면 현재 있는 Zustand와 React 19의 내장 훅(`useOptimistic` 등)만으로 해결할지 의견 부탁드립니다. (의존성을 늘리지 않고 React 19 기능만으로 충분히 성능 최적화가 가능합니다.)
> - 파일의 전체적인 위치가 대폭 변경될 텐데, PR 검토시 어려움이 없으신가요? 코드가 너무 크게 바뀌면 단계적인 분할 배포가 안전할 수 있습니다. 어떻게 나누어서 진행할지 혹은 한번에 모두 진행할지 선택해주세요.

---

## Verification Plan

### Automated Tests
- `npm run test:e2e`: 분할 전/후 E2E 테스트 스크립트 실행으로 기능 유실(Regression)이 없는지 확인.
- `npm run lint` 및 타입체크 검사 수행.
- Next.js 빌드(`npm run build`) 결과로 Next.js 번들 크기가 기존 대비 몇 퍼센트 감소하였는지 터미널 지표로 검증.

### Manual Verification
- 브라우저를 띄워 **운동 로그 스크롤시 Jank 여부**, **세트 완료 버튼 클릭시의 반응 속도(즉시 반영)** 등을 직관적으로 체감 및 영상(스크린샷) 확보 후 제공.
