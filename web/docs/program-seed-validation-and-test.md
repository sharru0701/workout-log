# Program Seed / Workout Validation Report (2026-03-04)

## 변경 목적
- 새 기능 대규모 개발이 아니라, 기존 앱에 대표 프로그램 데이터를 세팅하고 운동기록 흐름을 검증
- 기존 구조/도메인/스키마 대변경 없이 최소 수정

## seed 반영 내용

### 1) 프로그램 데이터
- 신규 `LOGIC` 템플릿
1. `operator`

- 신규 `MANUAL` 템플릿
1. `starting-strength-lp`
2. `stronglifts-5x5`
3. `texas-method`
4. `gzclp`
5. `greyskull-lp`

- 검증용 플랜(유저: `dev`)
1. `Program Tactical Barbell Operator`
2. `Program Starting Strength LP`
3. `Program StrongLifts 5x5`
4. `Program Texas Method`
5. `Program GZCLP`
6. `Program Greyskull LP`

### 2) 운동종목 최소 보완
- 추가
1. `Power Clean`
2. `Front Squat`

- 별칭 보강
1. `Overhead Press`에 `Press` alias 추가

### 3) 샘플 테스트 데이터 파라미터
- `sessionKeyMode: "DATE"` 적용 (프로그램 기반 날짜 재진입 테스트 용이)
- `startDate: "2026-01-05"` 고정
- Operator: `%TM` 기반 6주 파형(70/80/90/75/85/95), 기본 `mainSets=3`, `deadliftSets=1`
- Greyskull: 마지막 세트 `AMRAP 5+` note 노출 확인
- GZCLP: `percent` + `T3 AMRAP` note 노출 확인

### 4) 레거시 정리/초기화
- seed 실행 시 아래 legacy 템플릿과 연결 플랜/로그를 자동 정리
1. `starter-fullbody-3day`
2. `531`
3. `candito-linear`
- 배포 후 전체 정리가 필요하면 아래 방식으로 강제 초기화 후 seed 가능
```bash
WORKOUT_SEED_RESET_ALL=1 pnpm db:seed
```

## 최소 수정 코드

### 1) 처방 표시 보강 (UI)
- 파일: `src/app/workout/today/log/page.tsx`
- 파일: `src/app/workout/session/[logId]/page.tsx`
- 수정 내용:
1. planned set의 `percent`/`note`를 행 UI와 비교표에 표시
2. AMRAP/top set/T1~T3 성격을 `set.note`로 노출

### 2) 기존 기록 수정 API 보강
- 파일: `src/app/api/logs/[logId]/route.ts`
- 수정 내용:
1. `PATCH /api/logs/[logId]` 추가
2. 소유권 검증 후 세트 교체(삭제 후 재삽입) 방식으로 업데이트
3. stats cache 무효화 유지

### 3) 통합 검증 스크립트 추가
- 파일: `src/server/db/verifyProgramWorkflows.ts`
- 패키지 스크립트: `db:verify:programs`
- 검증 범위:
1. 프로그램별 세션 생성 결과(운동순서/세트수/rep/percent/note)
2. 로그 저장(POST) → 재조회(GET)
3. 로그 수정(PATCH) → 재조회(GET)

## 실행한 테스트와 결과

### 실행 명령
```bash
cd web
pnpm db:migrate
pnpm db:seed
pnpm db:verify:programs
```

### 결과 요약
- `db:migrate`: 성공
- `db:seed`: 성공
- `db:verify:programs`: 성공
  - Operator / Starting Strength / StrongLifts / Texas / GZCLP / Greyskull 세션 생성 검증 통과
  - 로그 저장/재조회/수정/재조회 통과

## 수동 검증 체크리스트 (운동기록 화면)

### A. 프로그램 처방 표시
1. `/workout/today/log`에서 플랜 선택
2. `1) 세션 생성/적용` 실행
3. 세트 카드에서 `처방` 문구에 reps/중량/percent/note 표시 확인
4. 하단 비교표에서 planned와 actual 분리 표시 확인

### B. 입력/저장/재조회
1. 일부 세트만 `완료` 체크
2. `반복/중량` 값 수정
3. `로그 저장` 실행
4. 생성된 상세 링크(`/workout/session/[logId]`) 재진입
5. 수정값 유지 및 planned note/percent 표시 확인

### C. 기존 기록 수정
1. API 기준: `PATCH /api/logs/[logId]`로 세트 수정
2. `GET /api/logs/[logId]` 재조회 시 변경 반영 확인

## 발견 이슈와 처리
1. 이슈: 로컬 DB에서 `workout_set.weight_kg`가 `integer`로 남아 소수 중량 업데이트 실패
2. 원인: `0011_furry_the_order.sql` 마이그레이션 미적용 상태
3. 처리: `pnpm db:migrate` 적용 후 정상화 (`numeric(8,2)`)

## 의도적으로 하지 않은 것
1. 프로그램 엔진 신규 kind 추가/재작성
2. 운동기록 페이지 구조 재설계
3. 도메인 모델/스키마 대규모 변경

## 참고
- canonical 조사 문서: `docs/program-seed-canonical-research.md`
