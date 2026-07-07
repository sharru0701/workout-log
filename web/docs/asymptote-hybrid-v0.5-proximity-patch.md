# Hybrid v0.5 — Proximity Patch (Claude Code 이식 스펙)

> Asymptote × Async Hybrid v0.4에 얹는 근접도(proximity) 패치.
> 목적: 하이브리드의 자인된 미해결 약점("스쿼트 강도 과소, TM 0.87로 완화 — 완전 해결 아님", hybrid doc §4·§5)을 해결한다.
> 선결 조건이었던 "TB 정체 확인"은 충족됨 — 실측: 1년 정체 + 2026-06-20 스쿼트 92.5kg×3 @ RPE 9~10 (e1RM ≈ 102~105, 1년 전 수준).

| 항목 | 내용 |
|---|---|
| Version | 0.5 (spec) |
| 베이스 | Hybrid v0.4 (asymptote-async-hybrid.md) — 전 메커니즘 유지 |
| 변경 | A. 프라이밍 탑세트(핵심) · B. 세션A 스쿼트 계수 다이얼(스테이징) · C. 진입 1RM 값 |
| 비대상 | 무릎 관리는 프로그램 외부의 개인 운영(자세·깊이 통제)으로 유지 — 스펙에 포함하지 않음. 템포/스왑 규칙도 미포함 |

---

## 0. 문제 정의 (왜)

현재 최대 스쿼트 작업 무게 = TM(1RM×0.87) × 사이클3(0.975) × 세션A(0.875) ≈ **1RM의 74.2%**.
- ≥80% 1RM 노출이 구조적으로 0. 근력(1RM)은 고부하 노출의 함수 (고부하>저부하, Schoenfeld 2017 등 — 대화 분석 문서 참조).
- 실패 근접은 사이클3 AMRAP(중간 무게 rep-out) 블록당 1회뿐.
- 사용자 정체 진단: "빈도·근접도·회복가능 볼륨을 동시에 가진 적 없음" — 하이브리드는 빈도·볼륨은 갖췄으나 근접도 공백.

해법 원칙: **하이브리드 철학 보존** — 진행 판정은 AMRAP만(Asymptote), 무거운 노출의 천장은 그라인딩-정지(Async). 탑세트는 자극·기술 연습이지 진행 신호가 아니다.

---

## A. 프라이밍 탑세트 (핵심 변경)

### A.1 규칙
- **대상 슬롯**: 각 리프트의 강도 슬롯 — SQ(세션A), PULL(세션A), BP(세션C). (DL·OHP 제외 — 보조 역할 유지)
- **발동 사이클**: 2·3만. (사이클1=적응, 사이클4=디로드, lightBlockMode 제외)
- **처방**: 워밍업 후, 기존 작업 세트 **앞에** 1세트 × 3렙 목표, `stopOnGrind: true`. 그라인딩 시 2렙(또는 1렙)에서 랙 — 실패 아님, 그날 보정.
- **무게**: 기존 공식 재사용 — 슬롯 계수 **1.0**. 즉 `floorToMultiple2p5(TM × cycleCoef × 1.0)`.
  - 사이클2 = TM×0.95, 사이클3 = TM×0.975 → 자연 파동.
- **진행 로직 무영향**: AMRAP 게이팅 그대로. 탑세트 렙 미달은 `failureStreak`에 **반영하지 않는다**(v0.5 범위 — 트리거 디로드 의미론 불변). 모니터링은 e1RM 추세가 담당.
- **연속일 보류 없음**: AMRAP과 달리 진행 신호가 아니므로 `restDayGap` 가드 비적용. 그라인딩-정지가 밸브.

### A.2 효과 (사용자 실측 기준: SQ TM 89.5 / PULL TM 94(총중량) / BP TM 87)
| 리프트 | 사이클2 탑세트 | 사이클3 탑세트 | %1RM |
|---|---|---|---|
| SQ | 85.0 ×2~3 | 87.5 ×2~3 | 82.5% → 85% |
| PULL | 87.5(총) ×2~3 | 90(총) ×2~3 | ~81% → ~83% |
| BP | 82.5 ×2~3 | 82.5 ×2~3 | ~82.5% |

→ ≥80% 노출: 0회 → 리프트당 블록 2회(약 2주 간격). 검증: 6/20 실측 92.5×3 @ RPE9~10 → 87.5×2~3 ≈ RPE 8 (그라인딩-정지 여유 있음).

### A.3 구현 매핑 (실측 코드 위치)
| 항목 | 위치 | 내용 |
|---|---|---|
| 블루프린트 확장 | `packages/core/src/program-store/asymptote-blueprint.ts` | `AsymptoteLiftRow`에 선택 필드 `topSet?: { reps: number; coef: number; cycles: number[] }` 추가. SQ(세션1)·PULL(세션1)·BP(세션3) 행에 `{ reps: 3, coef: 1.0, cycles: [2, 3] }` 부여. 단일 진실원 원칙 유지 (audit §3.7 스타일) |
| 무게 계산 | `packages/core/src/program-engine/asymptote.ts` `calculateAsymptoteWorkingWeight` | **변경 없음** — coef 1.0 인자로 호출하거나, topSet용 헬퍼가 동일 공식(`tm × cycleCoef × topSet.coef`, `floorToMultiple2p5`) 사용 |
| 처방 생성 | `packages/core/src/program-engine/generateSession.ts` `generateAsymptote`(L594~) | row.topSet && cycles.includes(cycleInBlock) && !lightBlockMode → `PlannedSet` 1개를 세트 배열 **선두에** 삽입: `{ reps: 3, stopOnGrind: true, meta.topSet: true }`. amrap 플래그 금지 |
| 슬롯 커스터마이즈 경로 | `generateSession.ts` L905~ (slot형 asymptote 처방, `plannedExercisesFromAsymptoteManualSession` 계열) | LOGIC 경로와 동일 규칙 적용 — 두 경로 동작 일치 필수 |
| e1RM 모니터 | `program-engine/asymptote-monitor.ts` | **변경 없음** — `aggregateDriverExposures`가 일자별 최고 중량 세트를 집계하므로 탑세트가 자동으로 신호원이 됨 (모니터 신호 품질 부수 개선) |
| 진행 reducer | `packages/core/src/progression/reducer.ts` | **변경 없음** (v0.5 범위) |

### A.4 테스트
- 블루프린트: topSet이 SQ/PULL/BP 지정 슬롯에만 존재, cycles=[2,3].
- 처방: 사이클2·3에서 탑세트가 선두 1세트로 생성(무게=TM×cycleCoef, 2.5 내림), 사이클1·4·lightBlockMode에서 미생성, amrap=false·stopOnGrind=true·meta.topSet=true.
- 두 처방 경로(LOGIC/slot) 동일 출력.
- reducer: 탑세트 렙 미달이 failureStreak·TM에 무영향.
- 기존 스위트 회귀 없음: `asymptote-hybrid.test.ts`, `asymptote-monitor.test.ts`, `progression/asymptote-trigger-deload.test.ts`.

---

## B. 세션A 스쿼트 계수 다이얼 (스테이징 — 기본 OFF)

hybrid doc §5의 다이얼(0.875 → 0.90). 탑세트와 동시 투입하면 변수가 섞이므로 **1블록 뒤 조건부 활성화**.

- **플래그**: 블루프린트 상수 `ASYMPTOTE_SQUAT_A_COEF`(기본 0.875) 또는 row override — 단일 소스, 기본값 변경 없음.
- **활성 조건**(수동 판단): 탑세트 도입 후 ≥1 블록에서 (a) 사이클3 AMRAP 렙수 타겟 이상, (b) e1RM 추세 RISING/FLAT, (c) 회복 이상 없음 → 0.90으로 전환.
- 효과: 세션A 스쿼트 작업 세트 74.2% → 76.3% (사이클3 기준). 탑세트가 주 근접도원이므로 이 다이얼은 보조.
- 테스트: 플래그 기본 OFF에서 기존 무게 산출 불변.

---

## C. 진입 1RM 입력값 (플랜 시작)

실측 데이터 기반 (2026-07 DB 분석 — TM 드리프트 보정 후 보수 추정). `resolveStartTmPercent`의 하이브리드 0.87 오버라이드는 **변경 없음**.

| 리프트 | 입력 1RM | → TM (×0.87) | 근거 |
|---|---|---|---|
| SQUAT | 103 | ≈ 89.5 | 6/20: 92.5×3 @ RPE9~10 → e1RM 102~105 |
| BENCH | 100 | ≈ 87.0 | 85×3×3 무난 + TM 드리프트 보정 |
| PULL(총중량) | 108 | ≈ 94.0 | 최근 +15~16×3 @ 85%주 정합, 체중 기록 전제 |
| DEADLIFT | 100 | ≈ 87.0 | 87.5~90×3 실측, 캡 DL≤SQ 준수 |
| OHP | 50 | ≈ 43.5 | 캡 BP×0.5, 현행 40~42.5와 정합 |

---

## D. 명시적 제외 (스코프 아웃)

- **무릎 관련 일체** (게이트·깊이 천장 스펙·등척성 워밍업·템포 HSR·무릎 AMRAP 가드): 사용자 결정 — 자세·깊이 통제로 프로그램 외부에서 개인 운영, 개선 추세 확인됨. 프로그램 스펙·엔진에 노이즈로 반영하지 않는다.
- 세션 스왑 규칙: 기존 `restDayGap` AMRAP 가드로 연속일 리스크 충분 커버 — 미도입.

---

## 부록: 버전 히스토리 (asymptote-async-hybrid.md에 추가)

| Version | Date | Changes |
|---|---|---|
| 0.5 | 2026-07-07 | 프라이밍 탑세트(SQ/PULL/BP, 사이클2·3, coef 1.0, stopOnGrind, 진행 무영향) — 근접도 공백(≥80% 노출 0회) 해소. 세션A 스쿼트 계수 다이얼 스테이징 플래그. 진입 1RM 실측값 확정. |
