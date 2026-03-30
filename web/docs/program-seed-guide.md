# 프로그램 Seed 가이드

> `program-seed-canonical-research.md` + `program-seed-validation-and-test.md` 통합본
> 최종 업데이트: 2026-03-04

---

## 목차

1. [채택 프로그램 목록](#1-채택-프로그램-목록)
2. [제외 항목](#2-제외-항목)
3. [구현 원칙](#3-구현-원칙)
4. [Seed 실행 명령](#4-seed-실행-명령)
5. [구현 내용](#5-구현-내용)
6. [수동 검증 체크리스트](#6-수동-검증-체크리스트)
7. [알려진 이슈](#7-알려진-이슈)

---

## 1. 채택 프로그램 목록

| # | 프로그램 | 타입 | 성격 |
|---|----------|------|------|
| 1 | Tactical Barbell Operator | LOGIC | 로직 검증용, 6주 파형(70/80/90/75/85/95) |
| 2 | Starting Strength LP | MANUAL | 초급 선형 증량, A/B 로테이션 |
| 3 | StrongLifts 5x5 | MANUAL | 초급 선형 증량, A/B 5x5 |
| 4 | Texas Method | MANUAL | 주간 강도 변화 (Volume/Recovery/Intensity) |
| 5 | GZCLP | MANUAL | Tier 구조 (T1/T2/T3), AMRAP 성격 |
| 6 | Greyskull LP | MANUAL | A/B 구조, 마지막 세트 AMRAP 5+ |

**선정 이유 요약**

| 성격 | 프로그램 |
|------|----------|
| LOGIC 템플릿 검증 | Tactical Barbell Operator |
| 초급 선형 증량형 | Starting Strength LP, StrongLifts 5x5 |
| 주간 강도 변화형 | Texas Method |
| Tier/Top-set 검증 | GZCLP |
| AMRAP 성격 검증 | Greyskull LP, GZCLP |

### 프로그램별 canonical 규칙 출처

| 프로그램 | 채택 규칙 요약 | 출처 |
|----------|---------------|------|
| Tactical Barbell Operator | 6주 파형, submax TM 기반, 3일 고빈도 | boostcamp.app, liftosaur.com |
| Starting Strength LP | A/B 로테이션, Squat 3x5, Press/Bench 교차, Deadlift 1x5 | startingstrength.com, outlift.com |
| StrongLifts 5x5 | A/B 로테이션, 주운동 5x5, B-day Deadlift 1x5 | stronglifts.com |
| Texas Method | Volume/Recovery/Intensity 3일, Intensity day top set 중심 | startingstrength.com, setforset.com |
| GZCLP | T1 저반복/고강도, T3 고반복 + AMRAP | boostcamp.app, liftosaur.com |
| Greyskull LP | 2x5 후 마지막 세트 5+ AMRAP, Deadlift 단일 고반복 | boostcamp.app, liftvault.com |

---

## 2. 제외 항목

- 코치/개인별 세부 증량 규칙 (실패 시 리셋 규칙의 세부 분기)
- 보조운동 대규모 템플릿
- 책/유료 자료에만 있는 상세 변형
- `%TM` 기반 5/3/1 계열 (legacy `531`, `candito-linear` 제거됨)
- 프로그램 엔진 신규 kind 추가

---

## 3. 구현 원칙

- 엔진 재작성 없이 기존 `LOGIC + MANUAL` 체계 사용
- rule 다양성은 manual session의 `note/percent`로 표현
- AMRAP/top set/back-off 성격은 `set.note` 기반으로 UI에서 표시

### 핵심 파라미터 (샘플 테스트 데이터)

```
sessionKeyMode: "DATE"       // 날짜 재진입 테스트 용이
startDate:      "2026-01-05"
```

**Operator TM 설정**:
- `TM = 90% 1RM` 기반 6주 파형 (70/80/90/75/85/95)
- `SQUAT/BENCH/DEADLIFT/PULL` TM 입력 지원
- `D1/D2 = Squat+Bench+Pull-Up`, `D3 = Squat+Bench+Deadlift`
- 기본 `mainSets=3`, `deadliftSets=3`

**Auto-progression 적용 대상 (기본 ON)**:
- Program Tactical Barbell Operator
- Program Greyskull LP

---

## 4. Seed 실행 명령

```bash
# 기본 seed (템플릿 + 운동 카탈로그)
pnpm db:seed

# 검증용 샘플 플랜까지 포함
pnpm db:seed:demo-plans

# 레거시 정리 후 전체 초기화 + seed
WORKOUT_SEED_RESET_ALL=1 pnpm db:seed

# 샘플 플랜까지 전체 초기화 + seed
WORKOUT_SEED_RESET_ALL=1 pnpm db:seed:demo-plans

# 검증 스크립트 실행
pnpm db:verify:programs
```

**정리되는 레거시 템플릿** (seed 시 자동):
- `starter-fullbody-3day`
- `531`
- `candito-linear`

---

## 5. 구현 내용

### 5-1. 프로그램 데이터

**신규 LOGIC 템플릿**: `operator`

**신규 MANUAL 템플릿**:
1. `starting-strength-lp`
2. `stronglifts-5x5`
3. `texas-method`
4. `gzclp`
5. `greyskull-lp`

**검증용 플랜** (유저: `dev`):
1. Program Tactical Barbell Operator
2. Program Starting Strength LP
3. Program StrongLifts 5x5
4. Program Texas Method
5. Program GZCLP
6. Program Greyskull LP

### 5-2. 운동 종목 보완

추가:
- `Power Clean`
- `Front Squat`

별칭 보강:
- `Overhead Press` → `Press` alias 추가

### 5-3. UI 최소 수정 (처방 표시)

**수정 파일**:
- `src/app/workout/today/log/page.tsx`
- `src/app/workout/session/[logId]/page.tsx`

**수정 내용**:
- planned set의 `percent/note`를 행 UI와 비교표에 표시
- AMRAP/top set/T1~T3 성격을 `set.note`로 노출

### 5-4. 기록 수정 API 추가

**파일**: `src/app/api/logs/[logId]/route.ts`

**추가**:
- `PATCH /api/logs/[logId]` — 소유권 검증 후 세트 교체 (삭제 후 재삽입)
- stats cache 무효화 유지

### 5-5. Auto-progression (Stage 1)

**신규 테이블**:
- `plan_runtime_state` (플랜별 누적 상태)
- `plan_progress_event` (로그 기반 진행 이벤트)

**신규 파일**:
- `src/server/progression/reducer.ts` — 순수 규칙 계산
- `src/server/progression/autoProgression.ts` — DB 반영 + PATCH replay
- `src/server/program-engine/generateSession.ts` — runtime state 오버레이

**기본 정책**:
- Operator: 블록 내 증량 없이 3일 완료 시 day/week/cycle 전진, 6주 블록 완료 후 증량
- Greyskull: 성공 시 선형 증량, 실패 누적 시 reset
- `PATCH /api/logs/[logId]` 시 해당 로그 이벤트 재계산 + 이후 이벤트 순차 replay

### 5-6. 자동 진행 UX

**신규 파일**:
- `src/lib/progression/summary.ts` — 자동 진행 요약/라벨 공통 포맷
- `src/server/progression/summary.ts` — 진행 이벤트 응답 payload 변환

**수정 파일**:
- `src/app/api/logs/route.ts` + `src/app/api/logs/[logId]/route.ts` — `progression` 응답 포함
- `src/app/workout/today/log/page.tsx` — 저장 직후 자동 진행 요약 표시
- `src/app/workout/session/[logId]/page.tsx` — 세션 상세에서 이벤트/타겟 결정 표시
- `src/app/api/plans/[planId]/route.ts` + `src/app/plans/manage/page.tsx` — `autoProgression` ON/OFF 토글

---

## 6. 수동 검증 체크리스트

### A. 프로그램 처방 표시

1. `/workout/today/log`에서 플랜 선택
2. `1) 세션 생성/적용` 실행
3. 세트 카드에서 처방 문구에 reps/중량/percent/note 표시 확인
4. 하단 비교표에서 planned와 actual 분리 표시 확인

### B. 입력/저장/재조회

1. 일부 세트만 `완료` 체크
2. `반복/중량` 값 수정
3. `로그 저장` 실행
4. `/workout/session/[logId]` 재진입
5. 수정값 유지 및 planned note/percent 표시 확인

### C. 기존 기록 수정

1. `PATCH /api/logs/[logId]`로 세트 수정
2. `GET /api/logs/[logId]` 재조회 시 변경 반영 확인

### D. 자동 진행 UX

1. `/plans/manage`에서 대상 플랜의 `자동 진행 ON/OFF` 토글 동작 확인
2. `/workout/today/log` 저장 후 `자동 진행` 안내 행 노출 확인
3. `/workout/session/[logId]`에서 자동 진행 이벤트/타겟별 결정 표시 확인

---

## 7. 알려진 이슈

| 이슈 | 원인 | 처리 |
|------|------|------|
| `workout_set.weight_kg`가 `integer`로 남아 소수 중량 업데이트 실패 | `0011_furry_the_order.sql` 미적용 | `pnpm db:migrate` 후 정상화 (`numeric(8,2)`) |

### 의도적으로 하지 않은 것

- 프로그램 엔진 신규 kind 추가/재작성
- 운동기록 페이지 구조 재설계
- 도메인 모델/스키마 대규모 변경

### 검증 결과 (2026-03-04)

| 명령 | 결과 |
|------|------|
| `pnpm test:progression` | 3 pass |
| `pnpm build` | 성공 |
| `pnpm db:migrate` | 성공 |
| `pnpm db:seed` | 성공 |
| `pnpm db:verify:programs` | Operator/Starting Strength/StrongLifts/Texas/GZCLP/Greyskull 전체 통과 |
