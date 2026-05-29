# Workout Log — 코드베이스 감사 및 방향 평가 (최종 보고서)

> 대상: 1인 개발·1인 사용 근력 운동 트래커 (~70k LOC, Next.js 16 App Router · React 19 · Drizzle/pg on Supabase · Vercel · PWA 표방).
> 본 보고서의 모든 핵심 주장은 코드에서 재검증했으며 `file:line`으로 근거를 표기한다. 적대적 검증(스켑틱)의 판정도 그대로 반영한다.

---

## 1. 한눈에 보기 (TL;DR)

**최종 권고: 재작성하지 말 것. 경로 A(유지·개선)를 채택하되, 적대적 검증이 지적한 오류를 바로잡은 "축소판"으로 실행하라.** 이 앱의 진짜 자산은 (1) 순수하고 테스트로 고정된 자동 진행 엔진(`reducer.ts` 외, 32 테스트 통과), (2) 체육관에서 검증된 draft 영속화(localStorage+IndexedDB 이중 기록), (3) 위반 0의 V2 디자인 시스템이다. 재작성은 이 자산들을 사용자 가치 0으로 위험에 빠뜨린다. 실제 부채는 평범하고 점진적이다 — 죽은 코드 약 1,000~1,500 LOC, 단 하나의 역방향 의존, 라이브 화면 1곳의 N+1 쿼리, 그리고 존재하지 않는 파일을 참조하는 유명무실한 PWA 설정.

### 우선순위 요약

| 우선도 | 작업 | 근거 | 노력 |
|---|---|---|---|
| 즉시 (P0) | 죽은 zustand `/workout/[sessionId]` 서브트리 삭제 → zustand+immer 의존 제거 | `store/workoutStore.ts:1-2`가 유일 소비자 | S |
| 즉시 (P0) | `/api/stats/strength-summary` N+1 + 무캐시 수정 | `route.ts:56` 루프 내 1000행 쿼리, `Cache-Control` 없음 | M |
| 즉시 (P0) | 죽은 offline-queue 인프라 삭제 (또는 정직하게 구현) | `queueIfOffline`는 호출자 0, online/offline 리스너 0 | S |
| 다음 (P1) | `server/ → features/` 역방향 의존 1건 교정 | `load-workout-log-context.ts:18` | S~M |
| 다음 (P1) | 나머지 죽은 코드 정리 (legacy 셰임, HomeDashboard, **루트** seed.ts, ts-node) | importer 0 검증 | S |
| 나중 (P2) | iOS 잔여 풋건 (죽은 viewport-lock CSS, fixed;inset:0 화면) | `layout.css:48-89` 등 | M |
| 나중 (P2) | `cacheComponents`(PPR) 채택 여부 결정 | cache primitive 사용 0 | S |
| **하지 말 것** | 풀 재작성(네이티브/로컬-퍼스트/대체 웹), 정규 FSD 전면 전환, error급 레이어 린트 즉시 도입 | 모든 적대적 판정이 reject 또는 강한 downgrade | — |

---

## 2. 검증된 코드베이스 현황 (사실 기반)

**하나의 일관된 라이브 아키텍처 (부분적 FSD):** `app/`(라우트/SSR 부트스트랩) → `widgets/`(화면 조립) → `features/*/`(`model`+`ui`+`store`) → `components/v2/primitives`(사실상 공유 UI 커널, 23~24 파일, ~48 importer) → `lib/`(순수 커널) → `server/`(DB + 도메인 엔진). 라이브 5개 화면(workout-log, program-store, exercise-detail, calendar, stats) 모두 이 흐름을 깔끔히 따른다.

**상태 관리 (Grep 검증):**
- `jotai` = 진짜 클라이언트 상태 라이브러리: **12개 파일**, 전부 `features/workout-log/*` 및 `widgets/workout-log-screen` 하위.
- `zustand` = 정확히 **1개 파일**(`store/workoutStore.ts:1`)에서만 import. `immer`의 라이브러리 용도도 동일 파일(`:2`) 단 1곳 (나머지 "immer" 매치는 CSS `skeleton-shimmer` 키프레임).
- `swr`/`react-query` 의존 없음. `lib/api.ts`(~429줄)는 손수 만든 SWR 캐시(in-memory Map + IndexedDB `wl-api-cache` 영속 + 시작 시 pre-aged warm-up).
- `@tanstack/react-virtual` 1개 파일(`exercise-catalog-content.tsx`), `idb` 4개 storage/cache 파일에서 실사용.

**데이터 모델 (24개 Drizzle pgTable, `server/db/schema.ts`):** 버전드 프로그램 카탈로그 → 사용자별 plan 인스턴스 + 런타임 진행 상태 + append-only 이벤트 로그 → 정규화된 workout log/set. UUID PK, 진화하는 부분은 jsonb. **14개 `references()` FK는 전부 program/plan 서브트리 내부 — `appUser`를 참조하는 FK는 0개.** 멀티유저 격리는 애플리케이션 레벨 전용(`user_id`는 맨 `text`, 56개 `WHERE user_id`). 마이그레이션은 선형·깔끔(18 파일).

**PWA/오프라인 실제 상태 (검증):** PWA는 **유명무실**. 서비스 워커 없음(`web/public/**`에 `sw.js` 없음), manifest 없음. `next.config.ts`/`proxy.ts`가 존재하지 않는 `sw.js`/`workbox-`/`manifest` 경로 참조. 오프라인 변경 큐(`lib/offline-queue.ts`)는 **완전 죽음** — `queueIfOffline`는 `api.ts:19`(타입)·`api.ts:428`(가드)에만 등장하고 이를 true로 넘기는 호출자가 없으며, `web/src` 전체에 online/offline 리스너가 **0개**(재검증). 실제 저장 경로는 실패 시 **throw**하는 Server Action(`save.ts:35-37`)이라 운동 완료 저장은 연결을 요구한다. 진행 중 **draft**만 견고하게 로컬-퍼스트(localStorage+IndexedDB `workout-draft-db`, pagehide-safe, 6h 만료) — 유일하게 제대로 엔지니어링된 오프라인 조각.

**자동 진행 엔진 (왕관 보석):** 결정 코어는 순수·스택 비종속. `reducer.ts`의 import는 순수 헬퍼 `resolveLoggedTotalLoadKg` 하나뿐(`reducer.ts:1`); drizzle/db/next/react import 0. 32개 유닛 테스트가 plain object로 순수 함수를 직접 호출하며 통과(18세션 Operator + 12세션 Asymptote 풀블록 시뮬레이션 포함). 코어 포팅은 ~1~2일, 단 event-sourcing replay 배관(`autoProgression.ts`)은 별개로 재작성 필요.

> ⚠️ **숫자 정정:** 일부 입력 문서가 `reducer.ts ~960`, `generateSession.ts 1356`로 표기했으나 실측은 `reducer.ts` 871줄, `generateSession.ts` 1228줄, `autoProgression.ts` 492줄, `lib/api.ts` 429줄이다. 결론에 영향은 없으나 명세로 인용 시 실측값을 쓸 것.

---

## 3. 핵심 발견 (우선순위순)

### 3.1 [중] DB 레벨 멀티유저 격리 부재 — 가장 위험한 구조적 갭
`user_id`는 맨 `text`이고 `appUser`로의 FK가 0개(`references(() => appUser` 매치 0). `WHERE user_id` 누락 한 번이면 데이터 누출/교차 기록이 가능하며 FK·RLS 백스톱이 마이그레이션에 확인되지 않는다. **1인 사용 맥락에서 실제 위험은 낮지만** 가장 위험한 구조적 빈틈이다. 부수적으로, 계정 삭제 정합성이 수작업 헬퍼(`deleteUserData.ts`)에만 의존한다(FK 캐스케이드 부재).

### 3.2 [중] 고아 zustand `/workout/[sessionId]` 프로토타입 (~600~740 LOC)
`page.tsx:11-34`가 하드코딩 더미(squat 60kg/bench 40kg)를 raw Tailwind로 렌더(토큰 규칙 위반). 어떤 내비게이션도 이를 가리키지 않음(라이브 타깃은 `/workout/log`와 별개의 읽기 전용 `/workout/session/[logId]`). **zustand+immer의 유일 소비자.** 단, `components/workout/nav-row.tsx`는 라이브(`plans/page.tsx`), `lib/storage/workoutSession.ts`의 `debounce` export는 라이브 draft 영속화가 사용 — 통째 삭제 금지.

### 3.3 [중] 리질리언스로 광고되는 죽은 오프라인-쓰기 인프라
`offline-queue.ts` + `queueIfOffline` 배관은 도달 불가(재검증: `api.ts:19`·`:428`만, 호출자·드레인·리스너 0). throw하는 Server Action 저장 경로와 결합해 오프라인 운동 완료 저장은 의도와 달리 작동하지 않는다.

### 3.4 [중] 의존 방향 역전: `server/`가 `features/`의 런타임 코드를 import
`server/services/workout-log/load-workout-log-context.ts:18`이 `@/features/workout-log/model/weight-rules`의 `applyWorkoutLogWeightRulesToDraft`를 import(이 헬퍼는 widget도 사용). 최하위 레이어가 feature 슬라이스를 상향 의존. 사실상 위치가 잘못된 공유 커널 코드.

### 3.5 [중] `/api/stats/strength-summary` N+1 + 무캐시 — 가장 현실적인 성능 개선점
`route.ts:56`이 우선순위 운동별로 루프하며 각각 1000행 쿼리를 await(`:62-81`). 요청당 ~5회 순차 왕복. `Cache-Control` 없고 stats-cache 미사용 — `api/home`·`api/stats/bundle`이 둘 다 캐시하는 것과 대조적. 라이브 stats 화면이 매 방문 호출.

### 3.6 [중] reducer ↔ generator 로직 중복/드리프트
운동→타깃 매핑 중복(`reducer.ts:108-127` vs `generateSession.ts:131-149`), 라운딩 3가지 구현, aux-TM 유도 3곳. 행동 드리프트의 잠재 원인이자 포팅 세금.

### 3.7 [중] Asymptote AMRAP 감지가 generator 토폴로지에 암묵 결합
`ASYMPTOTE_AMRAP_KEYS_BY_DAY = {1:[SQUAT,PULL], 3:[BENCH]}`(`reducer.ts:477-480`)는 generator가 정확한 주/일 순서로 세션을 짰다고 가정. 타입으로 강제되지 않는 계약 — 왕관 보석 엔진 양쪽 모두의 취약점.

### 3.8 [중→낮] 죽은 코드 클러스터 다수
`src/legacy/`(3 셰임 파일, importer 0), `components/home/home-dashboard.tsx`(264 LOC, `V2HomeDashboard`로 대체됨), 그리고 **루트 레벨** `src/server/db/seed.ts`(126 LOC, `./client` import 깨짐 — 루트에 `client.ts` 없음, 구식 `programTemplate.slug.eq(...)` API). 미사용 `ts-node` devDependency(모든 곳이 `tsx` 사용).

> ⚠️ **적대적 검증의 중대 오류 정정:** 경로 A 비판은 "`src/server/db/seed.ts`는 라이브이며 CI 필수이므로 삭제하면 CI가 깨진다"고 주장했으나, 이는 두 파일을 혼동한 것이다. CI(`ci.yml:91`)는 `working-directory: web`(`:76`)에서 `pnpm db:seed`를 실행하고, 이 스크립트(`web/package.json:32`)는 `tsx src/server/db/seed.ts` → **`web/src/server/db/seed.ts`**(880줄 라이브 `runSeed`, 실재하는 `./client` import)로 해석된다. 삭제 대상으로 거론된 것은 **저장소 루트의** `src/server/db/seed.ts`이며, 이는 실측 결과 깨진 import와 구식 API를 가진 진짜 고아다(루트에 `src/server/db/client.ts` 없음 확인). 즉 recon이 옳고, 비판은 무효다. (다만 비판이 환기한 교훈은 유효: **루트 seed만** 지우고 `web/` seed는 절대 건드리지 말 것.)

### 3.9 [낮] jsonb 무검증 역직렬화
`definition`/`state`/`snapshot`/`patch`를 `as Partial<...>` 캐스트 + 수치 강제(`reducer.ts:309-329`)로 읽음. Zod 가드 없음 — 스키마 드리프트에 취약.

### 3.10 [낮] `cacheComponents`/PPR 켜짐, cache primitive 0
`next.config.ts:25`가 on이지만 `"use cache"`/`cacheLife`/`cacheTag`/`unstable_cache` 사용이 `src` 전체에 0건. MEMORY가 기록한 preview 빈 화면 + typecheck-race 비용을 지면서 자동 static shell 외 이득은 미미.

### 3.11 [낮] iOS/Safari — 최대 churn 원천이나 완화는 성숙, 잔여 풋건 존재
~170~217/1027 커밋이 Safari/safe-area/dvh/auto-zoom 관련. 근본 원인(동적 뷰포트, 고정 풀스크린 레이어의 status-bar 틴트, 16px 입력 줌)은 플랫폼 고유이며 이미 견고히 완화됨. 잔여: 죽은 `body[data-viewport-locked]` CSS(`layout.css:48-89`, 세터 없음), `v2-auth-form`/`v2-onboarding`의 `fixed; inset:0`, `min-h-screen`(100vh) vs `.app-shell` 100dvh 순서 모호성.

*명예 언급(낮음):* React Compiler prod-only → dev/prod 렌더 갭; serverless당 `pg.Pool(max:5)`은 스케일 시 잠재 연결 풋건; `CLAUDE.md`가 존재하지 않는 `infra/` 디렉터리 참조.

---

## 4. 경로 A — 유지·개선 (no rewrite) ✅ **권고**

**논지:** 라이브 아키텍처는 이미 일관적이고 왕관 보석 로직은 실제로 잘 만들어졌다. 부채는 평범하고 점진적이며, 각 항목은 작고 독립 배포 가능하다. 엔진·V2 디자인 시스템·draft 영속화는 **불가침 불변식**으로 둔다.

**주요 변경안 (재정렬·정정 버전):**
1. **(S, P0)** zustand `/workout/[sessionId]` 서브트리 삭제 → `package.json`/`optimizePackageImports`에서 zustand+immer 제거. `nav-row.tsx`·`workoutSession.ts`의 `debounce`는 보존.
2. **(S, P0)** 죽은 `offline-queue.ts` + `queueIfOffline` 옵션/가드 삭제. 유령 `sw.js`/`manifest` 설정 정리. draft 영속화는 손대지 않음.
3. **(M, P0)** `strength-summary`를 단일 그룹 쿼리로 합치고 `Cache-Control`(예: `private, max-age=60, stale-while-revalidate=120`, `api/home/route.ts:42` 패턴) 추가. **사전에 현 출력 JSON 스냅샷으로 동치 검증.**
4. **(S~M, P1)** `weight-rules.ts`를 중립 위치(`lib/`)로 이동해 역방향 의존 해소. **단, 이 파일은 `@/entities/workout-record` 파사드도 import(`weight-rules.ts:7`)하므로** 파사드 정책과 함께 시퀀싱해야 하고, importer는 2개가 아니라 (server service + widget + 형제 컨트롤러) 더 많을 수 있으니 전수 grep 후 이동할 것.
5. **(S, P1)** 나머지 고아 삭제: `legacy/*`, `home-dashboard.tsx`, **루트** `src/server/db/seed.ts`(✱ `web/` seed 아님), `ts-node` devDep.
6. **(M, P2)** iOS 잔여: 죽은 viewport-lock CSS 삭제, auth/onboarding `fixed;inset:0` → `.app-shell` 100dvh, 100vh/100dvh 순서 정리. (실기기 Safari 검증 필요)
7. **(S, P2)** `cacheComponents` 의도적 결정 (끄거나, 최소 1개 cache primitive 채택).

**이주 비용:** 낮고 점진적. 상위 3개(P0)는 1일 내 대부분 가치 포착. 전체 ~3~4 집중일. 엔진은 어떤 항목에서도 수정 안 됨.

**이득:** 클라이언트 상태 라이브러리 1개 제거, ~1,000~1,500 LOC 죽은 코드 제거, 오해 소지의 "오프라인 리질리언스" 서사 제거, 라이브 화면 성능 버그 수정, 유일한 역방향 의존 교정.

**리스크:** "죽은" 파일이 실은 라이브일 가능성 → 각 삭제를 grep으로 importer 검증하고 알려진 예외(`nav-row.tsx` 라이브, `debounce` export 라이브)를 명시적으로 회피. 모든 삭제 PR을 typecheck + test:unit + test:progression으로 게이트.

### 적대적 검증 판정: **proceed-with-caveats (confidence: high)**
- 방향 자체는 **옳다**(1인 앱에 재작성 비정당).
- **그러나 비판의 핵심 반론(seed.ts 삭제 → CI 붕괴)은 본 보고서 §3.8에서 무효화됨** — 비판이 루트 seed와 `web/` seed를 혼동했다. recon의 삭제 대상(루트 seed)은 진짜 죽은 코드다.
- **유효한 정정:** ① CI 안전망 과장 — CI는 풀 `test:e2e`가 아니라 `smoke.spec.ts` 단일 스펙만 실행(`ci.yml:101`)하므로 삭제 안전망은 주로 typecheck에 의존. ② 레이어 이동(변경 4)은 importer가 2개 초과이고 `@/entities` 파사드 의존이 얽혀 있어 "byte-identical 2시간 이동"보다 약간 더 복잡. ③ iOS 변경의 `fixed;inset:0` 파일 귀속은 CSS 레이어에서 미검증(인라인 TSX일 가능성).

---

## 5. 경로 B — 스택 내 재아키텍처 (FSD-lite 명문화 + 레이어 린트 강제)

**논지:** 단일 레이어링 모델을 문서화하고, 빈 파사드 레이어(`entities/` 38 LOC, `shared/api/` 12 LOC — 둘 다 `lib/`로 되돌아가는 re-export 배럴)를 삭제하며, `server→features` 역방향을 교정하고, 기존 ESLint `no-restricted-imports`를 확장해 레이어 방향을 CI에서 강제.

**주요 변경안:** 레이어 모델 문서화(S) · 파사드 삭제 + ~20 importer 리포인트(M) · weight-rules 하향 이동(S) · **레이어 방향 ESLint를 error로**(M) · jotai 단일화 + zustand 서브트리 삭제(M) · 죽은 코드 정리(S) · (선택, 보류 권장) route→services 계약 정형화(L).

**이주 비용:** 핵심 부분 4~7 집중일(route→services 제외). 엔진은 미이동(이미 올바른 최하위·순수).

**이득:** 단일 명문 레이어 계약, "공유 코드의 집은 `lib/` 하나"라는 진실, `server/`가 진짜 최하위 레이어가 됨.

**리스크:** 코드모드가 배럴 소비자를 놓칠 수 있음. error급 린트가 알려진 1건 외 위반을 추가로 드러낼 수 있음.

### 적대적 검증 판정: **proceed-with-caveats — 단, 강한 다운그레이드 (confidence: high)**
- **치명적 반론(검증됨):** 제안의 핵심 셀링포인트("위반은 server→features 1건뿐, 룰을 error로 켜면 공짜로 경계 유지")는 **거짓 전제** 위에 있다. 라이브 홈 화면 `components/v2/v2-home-dashboard.tsx:29-30`이 `@/widgets/stats-screen`·`@/widgets/goal-aware/home-goal-section`를 **상향 import**한다(본 보고서 재검증 완료). 이 파일은 `app/page.tsx`가 렌더하는 라이브 루트 홈. 따라서 제안한 `components/v2/** → @/widgets` 금지 룰을 error로 켜면 **라이브 코드가 깨진다.** 이는 예산 미반영의 홈 화면 리팩터 또는 룰을 무력화하는 예외 추가를 요구.
- **검증된 또 다른 오류:** "`weight-rules.ts`는 `@/lib/*`만 import" → **거짓**. `weight-rules.ts:7`이 `@/entities/workout-record`(파사드)도 import.
- **검증된 또 다른 오류:** `components/v2`를 "깨끗한 primitive 커널 레이어"로 전제 → 실제로는 루트에 483 LOC `v2-home-dashboard.tsx`(widget import) 같은 화면 조립기가 섞여 있어 글롭이 `components/v2/primitives/**`로 한정돼야 함.
- **순효과:** 죽은 코드 삭제 + 문서화는 유익하나, **error급 경계 린트는 지금 도입 불가**. 더 나은 실행: 레이어 모델은 **문서로만** 적되, 린트 강제는 (a) `v2-home-dashboard`를 `components/v2/`에서 빼고 (b) 룰을 `primitives/`로 한정한 **이후로** 미룬다.

---

## 6. 경로 C — 네이티브/모바일 재작성 (Expo/RN, 또는 Swift)

**논지(제안자 본인도 반대):** 반복되는 iOS 통증(~21~23% 커밋)은 실재하고 네이티브 셸이 근본 원인을 제거할 수는 있다. 그러나 왕관 보석 엔진은 **이미** 순수 TS+32 테스트이고, 비싼 부분(24테이블 모델, 57 라우트, 20파일 auth 스택, event-sourcing replay)은 Swift 재작성에서 살아남지 못한다. Expo/RN이 유일하게 고려할 가치가 있으나, 그조차 PWA 완성 + 잔여 레이아웃 풋건 수정보다 정당화하기 어렵다.

**이주 비용(정직):** Expo/RN(백엔드 유지) **4~8주**. 순수 엔진은 ~1~2일에 포팅되지만, 181개 `.tsx`·V2 시스템(23 primitives + 74 components)·~4,030줄 CSS·jotai 소비자층·손수 만든 SWR 캐시·draft 영속화 스택은 전부 재작성. Swift+백엔드 포팅은 3~6개월(strictly worse).

**이득:** iOS 플랫폼 고유 통증 제거, 기본 오프라인-퍼스트, 진짜 오프라인 운동 **완료** 저장.

**리스크:** 거대한 폐기(위반 0의 V2 시스템 + 181 UI 파일), 비용 과소평가(엔진이 싼 부분), App Store 마찰($99/yr + 심사), 엔진 순수성/테스트 그린 회귀 위험.

### 적대적 검증 판정: **reject (confidence: high)**
- 제안서 스스로 "재작성하지 말라"고 결론.
- **검증된 오류:** "포터블 코어 ~1300줄 = reducer + asymptote + round + **4개 generate\* 함수**" → **refuted**. `generateSession.ts`(1228줄)는 DB 결합(`db` import, `:3`)이라 plain TS로 안 옮겨짐. 진짜 순수 코어는 ~964줄.
- iOS churn 통계는 **누적·완화 완료 작업 포함** → 미래 통증의 약한 프록시. 근본 원인은 이미 완화됨.
- save가 throw하는 것(`save.ts:35-37`)은 사실이나, 이 단 하나의 진짜 갭(오프라인 완료 저장)은 PWA/소규모 수정으로도 해결 가능. **네이티브 재작성 불요.**

---

## 7. 경로 D — 로컬-퍼스트 재작성 (디바이스가 데이터 소유, 서버는 백업/싱크)

**논지(제안자 본인도 반대):** 1인 오프라인 트래커에 교과서적으로 옳은 아키텍처이고 엔진은 잘 준비됨. 그러나 비용은 비엔진 부분(Postgres 전용 SQL ~10개 서비스 파일의 date_trunc/coalesce, tx 결합 replay, 57라우트+SWR 캐시 철거)이 지배. 결정적으로, **해결하려는 오프라인 문제는 대체로 종이 문제** — 진짜 중요한 오프라인 쓰기(진행 중 draft)는 이미 견고히 로컬-퍼스트이고, 광고된 오프라인-쓰기 큐는 죽은 코드라 잃을 것이 없다.

**이주 비용:** 충실한 풀 재작성 **4~7주**(PGlite 선택 시 stats SQL 보존; SQLite 선택 시 +~3주). 엔진 코어만 1~2일.

**이득:** 오프라인 운동 완료 저장, 손수 만든 캐시·죽은 큐 제거, 디바이스 데이터 소유.

**리스크:** 비엔진 비용이 지배(과소평가 위험), PGlite WASM 콜드스타트(특히 모바일 Safari = #1 churn 플랫폼), jsonb 무검증이 싱크 경계 넘으며 위험 증대, auth 식별자↔디바이스 DB 브리징 신규 심.

### 적대적 검증 판정: **reject (confidence: high)**
- 제안서가 자기 자신을 반대.
- **검증된 결함:** 제안서의 "더 싼 대안"(`queueIfOffline` + online 리스너 배선, ~2~4일)조차 **기술적으로 틀림** — 저장은 `lib/api.ts`(여기에 `queueIfOffline` 존재)를 거치지 않고 Server Action(`submit-workout-log.ts`)을 탄다. 따라서 `queueIfOffline` 배선은 완료 저장을 가로채지 못한다. 올바른 싼 수정: Server Action 실패 시 이미 견고한 draft를 'pending-finalize'로 보존하고 재접속 시 replay(현재 online 리스너 0개).
- 유일한 사용자 이득(오프라인 완료 저장)은 멀티주 재작성 없이 수일 내 달성 가능.

---

## 8. 경로 E — 대체 웹 스택 / 서버주도 (Svelte/SolidStart 또는 htmx/LiveView)

**논지(제안자 본인도 반대):** "React/Next 무거움"은 코드에서 증거가 없다 — `framer-motion` 0건, 번들은 이미 최적화(`optimizePackageImports`, `serverExternalPackages` pg, PPR, compress; `next.config.ts:21-50`), 진짜 클라이언트 상태는 jotai뿐. 서버주도(htmx/LiveView)는 이 앱의 코어 UX(355개 useState급 인터랙션, 입력 focus-chain, 오프라인 낙관 draft)에 **적대적**. 엔진을 Go/Elixir로 옮기면 작동하는 명세 고정 자산을 테스트 패리티 없는 언어로 재작성 — 순손실.

**이주 비용:** 최소악(Solid/Svelte, TS 유지) **4~8주**, 높은 회귀 위험. 서버주도(Go/Elixir)는 +엔진 전면 재작성으로 strictly worse.

**이득:** (JS 프레임워크 타깃) 더 작은 초기 JS 번들 — 단 1인·빠른 연결에서 체감 0. 실질 이득은 "죽은 의존 제거"인데 이는 이주 없이도 가능.

**리스크:** 체육관 검증 draft 영속화 상실/재구축, 위반 0 디자인 시스템 회귀, 작동하는 엔진 재작성.

### 적대적 검증 판정: **reject (confidence: high)**
- 제안서가 도달한 결론(Next.js/React 유지)이 지배적 선택임을 적대적 검증도 동의.
- 일부 카운트가 ~5~15% 과대(apiGet/apiPost 70 vs 81 등)이나 모두 보수적 방향이라 XL 결론 불변.
- **검증된 정정:** `next/server` 결합은 `server/` 하위 단 2파일(HTTP 경계)뿐 → 도메인 코어는 프레임워크 비결합(이주 시 유리하나, 그래서 더더욱 이주 불요). `framer-motion` 0건, 번들 최적화 설정 전부 확인.

---

## 9. 경로 비교 표

| 경로 | 이주 비용 | 주요 이득 | 주요 리스크 | 적대적 판정 | 추천 조건 |
|---|---|---|---|---|---|
| **A. 유지·개선** | 낮음 (~3~4일, 점진) | 죽은 코드/의존 제거, N+1 수정, 역방향 교정 | "죽은" 파일이 라이브일 가능성 (grep로 완화) | **proceed-with-caveats** | **현재 기본값. 지금 실행.** |
| B. 스택 내 재아키텍처 | 중 (4~7일, route→services 제외) | 단일 명문 레이어, 공유 코드 단일 집 | error급 린트가 라이브 홈 깨뜨림 | proceed-with-caveats (강한 다운그레이드) | 수개월 활발 개발 + 3구조 혼란이 실제로 발목 잡을 때. **린트 강제는 보류.** |
| C. 네이티브 재작성 | 높음 (Expo/RN 4~8주; Swift 3~6개월) | iOS 통증 제거, 기본 오프라인 | V2 시스템·181 UI 폐기, 비용 과소평가 | **reject** | iOS 통증이 PWA 완성 후에도 견딜 수 없고 오프라인 완료 저장이 일상 필수일 때만 |
| D. 로컬-퍼스트 재작성 | 높음 (4~7주, PGlite/SQLite로 ±3주) | 오프라인 완료 저장, 데이터 소유 | 비엔진 비용 지배, WASM Safari 리스크 | **reject** | 무신호 체육관 일상 + 데이터 소유가 하드 요구일 때만 |
| E. 대체 웹/서버주도 | 높음 (4~8주, 높은 회귀) | 더 작은 번들(체감 0) | draft 영속화 상실, 작동 엔진 재작성 | **reject** | 멀티유저·팀화 등 앱 성격이 근본 변화 시에만 |

---

## 10. 우선순위 로드맵

### 지금 (P0 — 첫 1일에 대부분 가치 포착)
1. **죽은 zustand `/workout/[sessionId]` 서브트리 삭제** → zustand+immer 의존 제거. `nav-row.tsx`·`workoutSession.ts` `debounce`는 보존. (typecheck + test:unit 게이트)
2. **죽은 offline-queue + `queueIfOffline` 삭제**, 유령 `sw.js`/`manifest` 설정 정리. draft 영속화는 불가침.
3. **`strength-summary` N+1 합치기 + `Cache-Control` 추가.** 사전 출력 JSON 동치 스냅샷.

### 다음 (P1)
4. **`server→features` 역방향 교정** — `weight-rules.ts`를 `lib/`로 이동. 단 `@/entities` 파사드 의존 동반 처리, importer 전수 grep, 이후 test:progression + workout-log e2e 확인.
5. **나머지 죽은 코드 정리:** `legacy/*`, `home-dashboard.tsx`, **루트** `src/server/db/seed.ts`(✱ `web/` seed 절대 금지), `ts-node` devDep.
6. **레이어 모델 문서화** (CLAUDE.md / docs) — error급 린트는 도입하지 않음.

### 나중 (P2 — Safari가 얌전하면 무기한 연기 가능)
7. iOS 잔여 풋건: 죽은 `body[data-viewport-locked]` CSS 삭제, auth/onboarding `fixed;inset:0` 교정(실기기 검증), 100vh/100dvh 순서. (단, `fixed;inset:0` 파일 귀속은 먼저 grep로 확인)
8. `cacheComponents`(PPR) 의도적 결정.
9. (성장/사용자 추가 전) DB 레벨 격리 백스톱 검토 — 방어적 app-level `user_id` 가드 또는 RLS. 엔진 매핑/라운딩 중복(§3.6) 단일화는 엔진 순수성 유지하며 선택적.

### 하지 말 것
- **풀 재작성(경로 C/D/E)** — 세 적대적 판정 모두 reject. 엔진이 포터블하다는 이유만으로 재작성하지 말 것; 순수하기 때문에 **제자리에 두고 주변만 청소**하는 것이 정답.
- **정규 FSD 전면 전환** (real `entities/`+`shared/` 채우기, 54개 lib 파일 레이어-세그먼트 슬라이싱) — 1인 앱에 수주 churn, 디자인 린트 베이스라인·draft 영속화 위험.
- **레이어 방향 ESLint를 지금 error로 도입** — 라이브 홈(`v2-home-dashboard.tsx:29-30`)을 깨뜨림. 전제 거짓.
- **`web/src/server/db/seed.ts` 삭제** — 라이브 + CI 필수. (삭제 대상은 **루트** seed만.)
- **route→services 57라우트 빅뱅 마이그레이션** — 사실상 재작성. 기회주의적으로만.
- **app-page.css 레거시 테일 즉시 제거** — DEPRECATED지만 ~11개 화면이 의존하는 진행 중 마이그레이션. 화면 손볼 때 자연 축소.
