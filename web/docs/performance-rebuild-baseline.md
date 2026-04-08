# 성능 재구축 기준선

작성일: 2026-04-08

## 목적

이 문서는 성능 재구축 작업의 Phase 0 기준선이다.

목표는 다음 두 가지다.

- 현재 구조에서 성능 병목이 어디에 몰려 있는지 고정한다.
- 이후 재구축 결과를 "느낌"이 아니라 전/후 비교로 설명할 수 있게 한다.

이 문서는 코드베이스 정적 분석 기준선이다. 실제 네트워크/프로파일링 수치는 이후 측정 결과를 추가한다.

---

## 현재 기술 기반

- 앱 중심 경로: `web`
- 프레임워크: `Next.js 16.1.6`, `React 19.2.3`, `App Router`
- DB/ORM: `Postgres`, `Drizzle`
- 스타일: `Tailwind 4` + custom CSS
- 클라이언트 상태: `Zustand 5` 일부 사용
- 빌드 최적화: production `reactCompiler` 활성화

---

## 현재 구조 요약

### 강점

- `Home`, `Workout Log`, `Calendar`, `Stats` 일부는 SSR/RSC 초기 데이터 프리패치가 이미 들어가 있다.
- `src/lib/api.ts`는 캐시, inflight dedupe, 네트워크 카운트, 오프라인 큐 기반을 이미 가지고 있다.
- `src/server/program-engine`, `src/server/progression`, `src/server/stats`, `src/lib/workout-record/model.ts`, `src/lib/program-store/model.ts`는 재사용 가치가 높은 도메인 자산이다.

### 핵심 구조 문제

- 화면 오케스트레이션이 giant client component에 과도하게 몰려 있다.
- `workout` 도메인에 구형/신형 흐름이 공존한다.
- route 경계와 feature 경계보다 파일 단위 성장에 의존해 화면이 비대해졌다.
- 화면별 최적화 방식이 제각각이라 공통 성능 전략을 적용하기 어렵다.

---

## 큰 파일 기준선

`web/src` 기준 상위 대형 파일:

1. `web/src/app/workout/log/_components/workout-log-client.tsx` 2954줄
2. `web/src/app/program-store/page.tsx` 2084줄
3. `web/src/lib/i18n/messages.ts` 1465줄
4. `web/src/app/calendar/_components/calendar-client.tsx` 1434줄
5. `web/src/server/program-engine/generateSession.ts` 1112줄
6. `web/src/app/templates/manage/page.tsx` 950줄
7. `web/src/lib/workout-record/model.ts` 928줄
8. `web/src/lib/program-store/model.ts` 891줄
9. `web/src/app/stats/_components/stats-1rm-detailed.tsx` 876줄

해석:

- 가장 위험한 파일은 큰 것 자체가 아니라, "큰 화면 클라이언트 파일"이다.
- `generateSession.ts`, `workout-record/model.ts`, `program-store/model.ts`는 크지만 도메인 로직 비중이 높아 재사용 가치가 있다.
- 반대로 `workout-log-client.tsx`, `program-store/page.tsx`, `calendar-client.tsx`, `stats-1rm-detailed.tsx`는 재구축 우선순위가 높다.

---

## Workout 도메인 중복 기준선

현재 `workout` 관련 주요 라우트:

- `/workout/log`
- `/workout/log/add-exercise`
- `/workout/log/exercise-catalog`
- `/workout/[sessionId]`
- `/workout/session/[logId]`
- `/workout/today`
- `/workout/today/overrides`

현재 구조 문제:

- `/workout/log`는 플랜 기반 기록 워크스페이스다.
- `/workout/[sessionId]`는 별도 `Zustand` 세션 흐름을 사용한다.
- `/workout/session/[logId]`는 수행 로그 상세/비교 화면이다.
- `/workout/today`는 진입 허브 성격이다.

해석:

- 같은 workout 도메인 안에서 상태모델과 화면 흐름이 둘 이상 공존한다.
- 성능 재구축 시 `/workout/log`를 중심으로 통합하지 않으면 구조 부채가 반복된다.

---

## 우선 재사용 대상

재구축 시 최대한 재사용:

- `src/server/program-engine/*`
- `src/server/progression/*`
- `src/server/stats/*`
- `src/lib/workout-record/model.ts`
- `src/lib/program-store/model.ts`
- `src/lib/settings/*`
- `src/lib/session-key.ts`
- DB schema / migration / seed

이유:

- 화면이 아니라 도메인 규칙, 변환, 서버 처리에 가깝다.
- 로직 이동 없이도 새 아키텍처에서 감쌀 수 있다.

---

## 우선 재구축 대상

1차 재구축 대상:

- `src/app/workout/log/_components/workout-log-client.tsx`
- `src/app/program-store/page.tsx`
- `src/app/calendar/_components/calendar-client.tsx`
- `src/app/stats/_components/stats-1rm-detailed.tsx`
- `src/app/workout/[sessionId]/page.tsx`
- `src/store/workoutStore.ts`
- `src/lib/workout/useWorkoutPersistence.ts`

이유:

- 사용자 상호작용이 많다.
- 로컬 state 범위가 넓다.
- giant component 또는 별도 상태 흐름으로 성장했다.
- route-level preload만으로 해결되지 않는 체감 병목 후보들이다.

---

## 현재 페이지별 성격

### 비교적 안정적

- `src/app/page.tsx`
  - server-first 성격이 강하다.
  - 1차 성능 재구축 우선순위는 낮다.

### 재구축 우선순위 높음

- `src/app/workout/log/page.tsx`
  - 서버 프리패치가 이미 있지만, 실제 병목은 giant client component에 있다.

- `src/app/program-store/page.tsx`
  - catalog, detail, customize, start-flow가 한 화면에 몰려 있다.

- `src/app/calendar/page.tsx`
  - SSR preload는 좋지만 `calendar-client.tsx`가 커서 화면 경계 분리가 필요하다.

- `src/app/stats/page.tsx`
  - SSR preload는 좋지만 상세 인터랙션이 큰 클라이언트 섹션에 남아 있다.

---

## Phase 0 측정 체크리스트

실측이 필요한 항목:

- `workout/log` 초기 진입 네트워크 waterfall
- `program-store` 초기 진입 네트워크 waterfall
- `calendar` 초기 진입 네트워크 waterfall
- `stats` 초기 진입 네트워크 waterfall
- route별 client JS payload
- 세트 입력, 검색 입력, sheet open/close, 저장 시 React commit time
- giant component별 리렌더 범위

권장 명령:

```bash
pnpm --dir web run typecheck
pnpm --dir web run lint
pnpm --dir web run test:unit
pnpm --dir web run test:e2e
pnpm --dir web run test:async-ux:continuity
pnpm --dir web run build
```

브라우저 측정:

- Chrome DevTools Performance
- React DevTools Profiler
- Network waterfall capture

---

## 초기 결론

현재 프로젝트는 "서버/도메인 계층은 재사용 가치가 높고, 화면 계층은 재구축 가치가 높은" 상태다.

따라서 최적 전략은 다음이다.

- 서버/도메인 자산을 살린다.
- `workout/log`부터 새 구조 진입점을 만든다.
- `program-store`, `calendar`, `stats` 순으로 giant component를 해체한다.
- 마지막에 legacy route와 중복 상태모델을 제거한다.
