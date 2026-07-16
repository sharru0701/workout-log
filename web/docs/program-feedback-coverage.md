# 프로그램 진행 피드백 커버리지 (패밀리 × 이벤트 × 기록 × 표출)

> v0.5.1 실패 프로토콜 피드백(asymptote 전용)을 **프로그램 공통 피드백 레이어**로 일반화하기 위한
> `progression/reducer.ts` 전수 감사 결과. 원칙: **판정 로직 변경 금지** — 기록 추가와 표출만.
>
> - **기록** = 판정이 `plan_progress_event`(decision reason 또는 집계 reason)에 남는가
> - **표출** = 웹 UI(세션 배너/진행 판정 카드/배지)가 사용자에게 보여주는가
> - 표출의 데이터원은 `GET /api/plans/:id/progression-state`의 `lastEvent`(reason + meta.targetDecisions)

## 집계(프로그램 공통) 이벤트

| reason | eventType | 발생 | 기록 | 표출 |
|---|---|---|---|---|
| `advance:session` | ADVANCE_WEEK | 세션 전진(모든 블록형) | ✅ | — (노이즈, 의도적 미표출) |
| `deload:trigger:regressed=<T,...>` | ADVANCE_WEEK | asymptote 조기 디로드 점프 | ✅ v0.5.1 F1 | ✅ 세션 배너 |
| `freeze:block:failed=<T,...>` | ADVANCE_WEEK | operator·531 블록 완주했으나 실패 누적 → 증량 동결 | ✅ **이번 패치 신규** (기존 무기록) | ✅ 판정 카드 |
| `override:per-target:<type>` | 집계 | 저장 시 사용자 실패 프로토콜 선택 | ✅ | ✅ 판정 카드(폴백 문구) |
| `manual:tm-adjustment` | 집계 | 플랜 관리에서 수동 TM 조정 | ✅ | — (사용자 자신의 행동) |
| `replay:updated` / `rebuild:cleared` | 시스템 | 로그 편집/재계산 | ✅ | — (시스템 내부) |

## 패밀리별 decision reason

### asymptote (하이브리드) — v0.5.1로 표출 완비

| reason | eventType | 기록 | 표출 |
|---|---|---|---|
| `hold:block-success` / `hold:block-failure` / `hold:no-data` | HOLD | ✅ | — (블록 중간 스트릭, 노이즈) |
| `increase:amrap-<n>reps:+2.5kg` | INCREASE | ✅ | ✅ 판정 카드 |
| `hold:amrap-<n>reps` | HOLD | ✅ | ✅ 판정 카드(유지·재도전) |
| `reset:amrap-<n>reps:-2.5kg` | RESET | ✅ | ✅ 판정 카드(재조준) |
| `reset:amrap-<n>reps:-5kg+light` | RESET | ✅ | ✅ 판정 카드 + F4 라이트 배지 |
| `hold:amrap-missing` | HOLD | ✅ | ✅ 판정 카드(판정 연기 — 침묵 금지) |
| `derived:dl=sq:<kg>kg` / `derived:ohp=bp*0.5:<kg>kg` | INCREASE/RESET | ✅ | ✅ 판정 카드(파생 갱신) |
| lightBlockMode 해제(블록 종료) | 상태 변화 | — (무기록) | ✅ 배지 자동 소멸로 충분 — 기록 불필요 판단 |

### operator (TB Operator Custom) — 이번 패치 ①

| reason | eventType | 기록 | 표출 |
|---|---|---|---|
| `hold:block-success` / `hold:block-failure` | HOLD | ✅ | — (블록 중간, 노이즈) |
| `increase:+<X>kg` (블록 완주 전 리프트 증량) | INCREASE | ✅ (기존) | ✅ **이번 패치 신규** — "스쿼트 +2.5 (N연속 성공)" |
| 블록 완주 + 실패 누적 → 증량 동결 | ADVANCE_WEEK | ✅ **이번 패치 신규** `freeze:block:failed=` (기존 **완전 무기록** — asymptote 조기디로드와 같은 유형) | ✅ 판정 카드 |

### wendler-531 (3변형 공통)

| reason | eventType | 기록 | 표출 |
|---|---|---|---|
| `increase:+<X>kg` (4주 블록 완주 증량) | INCREASE | ✅ | ✅ operator와 동일 카탈로그 |
| 블록 완주 동결 | ADVANCE_WEEK | ✅ **이번 패치 신규** `freeze:block:failed=` | ✅ 판정 카드 |

### gzclp (v2 stage 머신) — 이번 패치 ②

| reason | eventType | 기록 | 표출 |
|---|---|---|---|
| `increase:amrap>=25:+<X>kg` (T3) | INCREASE | ✅ | ✅ **이번 패치 신규** |
| `hold:amrap<25` (T3) | HOLD | ✅ | ✅ 판정 카드(유지) |
| `increase:stage-clear:+<X>kg` (T1/T2) | INCREASE | ✅ | ✅ 판정 카드 |
| `stage-down:<a>-><b>` (T1/T2 렙 스킴 강등) | HOLD | ✅ | ✅ 판정 카드(무게 유지·스킴 강등) |
| `reset:stage-exhausted:*<f>` | RESET | ✅ | ✅ 판정 카드(무게 리셋) |
| (비v2 gzclp) | — | generic LP와 동일 | 폴백 |

### texas-method (v2) — 폴백 커버(③)

| reason | eventType | 기록 | 표출 |
|---|---|---|---|
| `increase:weekly:+<X>kg` | INCREASE | ✅ | 폴백(증량 기본 문구) |
| `hold:intensity-fail` | HOLD | ✅ | — (유지, 노이즈) |
| `reset:intensity-fail:*<f>` | RESET | ✅ | 폴백(하향 기본 문구) |

### greyskull-lp (v2) — 폴백 커버(③)

| reason | eventType | 기록 | 표출 |
|---|---|---|---|
| `increase:amrap-<n>reps:double:+<X>kg` (Phrak's 더블) | INCREASE | ✅ | 폴백 |
| `increase:+<X>kg` | INCREASE | ✅ | 폴백 |
| `hold:failure-streak` | HOLD | ✅ | — |
| `reset:-<X>kg` / `reset:*<f>` | RESET | ✅ | 폴백 |

### generic LP (starting-strength · stronglifts · 비v2 greyskull/gzclp · 슬롯 LP) — 폴백 커버(③)

| reason | eventType | 기록 | 표출 |
|---|---|---|---|
| `hold:success-streak` | HOLD | ✅ | — (스트릭 진행, 노이즈) |
| `increase:+<X>kg` | INCREASE | ✅ | 폴백 |
| `hold:failure-streak` | HOLD | ✅ | — |
| `reset:-<X>kg` / `reset:*<f>` | RESET | ✅ | 폴백 |

## 무기록 지점(감사 결과) 및 처치

| 지점 | 패밀리 | 유형 | 처치 |
|---|---|---|---|
| 조기 디로드 점프 | asymptote | 상태 조용히 변경 | ✅ v0.5.1 F1에서 기록+표출 완료 |
| **블록 완주 증량 동결** (`hadBlockFailure`) | operator·wendler-531 | **완전 무기록** — 유저는 "왜 증량이 안 됐는지" 알 수 없음 | ✅ 이번 패치: `freeze:block:failed=<targets>` 집계 reason 기록(판정 불변) + 카드 표출 |
| lightBlockMode 해제 | asymptote | 상태 변화 | 기록 안 함 — F4 배지 소멸이 곧 표출이라 중복 |
| 스트릭 누적(hold:*-streak) | LP 전체 | 기록 있음·표출 없음 | 의도적 미표출(매 세션 노이즈) — 증량/리셋 시점에만 카드 |

## 표출 아키텍처 (공통 레이어)

- **파생·문구**: `web/src/features/workout-log/model/progression-feedback.ts`(엔진) +
  `progression-feedback-catalog.ts`(패밀리별 reason→문구 카탈로그). 미등록 reason은
  eventType 기반 기본 문구 폴백 — 새 reason이 추가돼도 UI가 깨지지 않는다.
- **컴포넌트**: `SessionFeedbackNotice`·`BlockJudgmentCard`(진행 판정 카드) — 프로그램 비종속
  웹 presentational 컴포넌트. Go TUI는 동일 서버 문구를 독립 렌더링한다.
- **노출 판정**: `lastEvent.targetDecisions` 중 "주목할 판정"(INCREASE/RESET, 또는 카탈로그가
  판정성으로 등록한 HOLD)이 있을 때만 카드. 블록 중간 스트릭 HOLD는 노이즈로 제외.
