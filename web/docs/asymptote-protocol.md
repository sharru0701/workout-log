# Asymptote Protocol

> 점근선 프로토콜 — 회복이 불안정한 중급 리프터를 위한 성과 기반 스트렝스 프로그램

| 항목 | 내용 |
|---|---|
| Version | 1.0 |
| 대상 | 일정 불규칙 + 영양/수면 불안정한 중급 리프터 |
| 목표 | 5개 컴파운드 리프트의 지속적 1RM 향상 |
| 측정 방식 | AMRAP 기반 (1RM 테스트 불필요) |
| 종목 수 | 5개 (변형 없음) |
| 주당 빈도 | 가변 (세션 기반 로테이션) |

---

## 목차

1. [개요 & 철학](#1-개요--철학)
2. [핵심 원리](#2-핵심-원리)
3. [프로그램 구조](#3-프로그램-구조)
4. [TM 시스템](#4-tm-시스템)
5. [부하 계산](#5-부하-계산)
6. [세션 상세](#6-세션-상세)
7. [AMRAP 프로토콜](#7-amrap-프로토콜)
8. [증량 프로토콜](#8-증량-프로토콜)
9. [실패 & 디로드 프로토콜](#9-실패--디로드-프로토콜)
10. [특수 상황 대응](#10-특수-상황-대응)
11. [세션 흐름](#11-세션-흐름)
12. [앱 구현 가이드](#12-앱-구현-가이드)
13. [예시 시나리오](#13-예시-시나리오)
14. [FAQ](#14-faq)

---

## 1. 개요 & 철학

### 1.1 문제 정의

기존 스트렝스 프로그램(SS, 5/3/1, nSuns, Tactical Barbell)들은 **"평균적인 회복 능력"을 가정한 캘린더 기반 자동 진행 모델**이다. 사이클이 진행되면 TM(Training Max)이 무조건 인상된다.

이 모델은 다음 사용자에게 작동하지 않는다:
- 영양·수면이 불안정한 사용자
- 운동 일정이 불규칙한 사용자
- 회복 능력이 평균 이하인 사용자
- 누적 피로가 표준 디로드로 해소되지 않는 사용자

이런 사용자는 **2-4 사이클에서 벽에 부딪힘** → 프로그램 갈아탐 → 새 프로그램에서도 다시 2-4 사이클 후 벽 → 반복.

### 1.2 해결 접근

**Asymptote Protocol**의 핵심 발상:

> **TM은 자동으로 올라가지 않는다. AMRAP 검증으로 "벌어야" 올라간다.**

수학에서 **점근선(asymptote)**은 곡선이 무한히 가까워지지만 결코 닿지 않는 선이다. 이 프로그램에서:

- **TM = 점근선**: 모든 작업이 TM 아래에서 일어나며, 어떤 사이클도 TM의 100%에 도달하지 않는다 (최대 97.5%).
- **실제 강도 = 곡선**: TM 자체가 천천히 위로 이동하면서, 실제 강도는 절대값으로는 계속 증가하지만 항상 천장 아래에 머문다.
- **벽이 없는 이유**: 점근선엔 닿을 지점이 없다 → 부딪힐 벽이 없다.

### 1.3 대상 사용자

**적합**:
- 6개월~2년 이상 바벨 경험
- 영양/수면이 불규칙한 직장인
- 클라이밍, 마샬아츠 등 컨디셔닝 병행
- 대회 목적이 아닌 지속적 1RM 향상 목표
- 1RM 측정을 선호하지 않음

**부적합**:
- 완전 입문자 (SS, GZCLP 등이 더 적합)
- 대회 피킹 필요 (Sheiko, Calgary 등 특화 프로그램 권장)
- 보디빌딩 목적 (RP, PHAT 등 권장)
- 회복이 우수하고 빠른 진행을 원하는 사용자

---

## 2. 핵심 원리

7가지 원리를 다음 우선순위로 적용한다.

### 2.1 특이성 (Specificity)
- 5개 종목만 사용. 변형 없음.
- 메인 3개: 스쿼트, 중량풀업, 벤치프레스
- 보조 2개: 데드리프트, 오버헤드프레스

### 2.2 점근선 원리 (Asymptote Principle)
- TM은 절대 도달 불가능한 천장.
- 사이클 3에서도 TM × 0.975까지만 사용.

### 2.3 성과 기반 진행 (Performance-Gated Progression)
- TM 인상은 캘린더가 아닌 AMRAP 결과로 결정.
- AMRAP 미달 시 TM 유지 또는 하향.

### 2.4 세션 단위 DUP (Daily Undulating Periodization)
- 같은 리프트를 세션마다 다른 자극(강도/볼륨/스피드)으로.
- 정체 회피의 핵심 메커니즘.

### 2.5 빈도 우선 (Frequency Priority)
- 정체된 리프트는 빈도로 깬다.
- 스쿼트: 3x / 사이클 (3가지 다른 자극)
- 메인 2개(벤치, 풀업): 2x / 사이클
- 보조 2개(DL, OHP): 1x / 사이클

### 2.6 서브맥시멀 (Submaximal Always)
- 실패까지 가지 않음.
- AMRAP은 사이클 3에서만, 메인 3개 리프트에서만.
- AMRAP도 RPE 9 한도 (1렙 더 가능한 시점에서 종료).

### 2.7 세션 기반 로테이션 (Session-Based Rotation)
- 캘린더 무관, 순서대로 진행.
- 연속일·휴식일 자유.

---

## 3. 프로그램 구조

### 3.1 종목 5개

| 코드 | 종목 | 역할 | TM 제약 |
|---|---|---|---|
| `SQ` | 스쿼트 (하이바) | 메인 #1 | 없음 |
| `BP` | 벤치프레스 | 메인 | 없음 |
| `WPU` | 중량풀업 | 메인 | 없음 |
| `DL` | 데드리프트 | 보조 | ≤ SQ TM (100%) |
| `OHP` | 오버헤드프레스 | 보조 | ≤ BP TM × 0.5 (50%) |

### 3.2 세션 구조

3개의 세션(A, B, C)을 **순서대로 무한 로테이션**한다.

```
A → B → C → A → B → C → A → B → C → ...
```

캘린더 무관. 연속일도, 3일 쉬어도 OK.

### 3.3 세션별 리프트 배분

| 세션 | 스쿼트 | 벤치 | 풀업 | DL | OHP | 자극 테마 |
|---|---|---|---|---|---|---|
| **A** | ✓ (강도) | ✓ (볼륨) | ✓ (강도) | - | - | 강도 중심 |
| **B** | ✓ (볼륨) | - | ✓ (볼륨) | ✓ | - | 볼륨 + 풀 |
| **C** | ✓ (스피드) | ✓ (강도) | - | - | ✓ | 스피드 + 프레스 |

**빈도 검증**:
- 스쿼트: 3x (강도/볼륨/스피드) → 정체된 메인 리프트 빈도 강화
- 벤치, 풀업: 2x (강도 + 다른 한 종류)
- DL, OHP: 1x (보조 역할)

### 3.4 사이클 구조

- **1 사이클** = A + B + C (3 세션)
- **1 블록** = 4 사이클 = 12 세션

| 사이클 | TM 계수 | AMRAP | 의도 |
|---|---|---|---|
| 1 | 0.925 | X | 적응 (Acclimation) |
| 2 | 0.95 | X | 빌드업 (Build) |
| 3 | 0.975 | ✓ | 검증 (Validation) |
| 4 | 0.85 | X | 디로드 (Deload) |

블록 종료 후 **AMRAP 결과로 TM 업데이트** → 다음 블록 시작.

---

## 4. TM 시스템

### 4.1 TM 정의

TM (Training Max) = 작업 기준 가중치. **실제 1RM이 아님**.

- 일반 프로그램: TM = 1RM × 0.9
- **Asymptote Protocol: TM = 1RM × 0.83** (회복 부족 고려, 더 보수적)

### 4.2 초기 TM 설정

3가지 방법 중 선택:

**방법 1: 최근 5RM 기반 (권장)**
```
TM = 최근 5RM × 1.05
```

**방법 2: 최근 1RM 기반**
```
TM = 1RM × 0.83
```

**방법 3: 추정 1RM (Epley)**
```
E1RM = weight × (1 + reps/30)
TM = E1RM × 0.83
```

### 4.3 TM 제약 (자동 캡)

**보조 리프트는 메인 리프트에서 파생**:

```
DL_TM ≤ SQ_TM
OHP_TM ≤ floor(BP_TM × 0.5 / 2.5) × 2.5
```

**구현 권장**:
- 사용자는 SQ, BP, WPU의 TM만 직접 관리
- DL, OHP TM은 시스템이 자동 도출
  - `DL_TM = SQ_TM`
  - `OHP_TM = floor(BP_TM × 0.5 / 2.5) × 2.5`
- 사용자가 별도 값을 원하면 오버라이드 허용 (단, 상한 강제)

### 4.4 TM 라운딩

- 모든 TM 및 작업 무게는 **2.5kg 단위**로 라운딩 (DOWN).
- 중량풀업의 추중량도 2.5kg 단위.

```
def round_weight(weight):
    return floor(weight / 2.5) * 2.5
```

---

## 5. 부하 계산

### 5.1 기본 공식

```
WorkingWeight = TM × CycleCoefficient × SessionCoefficient
```

라운딩 적용:

```
DisplayWeight = round_down_to_2.5(WorkingWeight)
```

### 5.2 계수 테이블

**Cycle Coefficient** (사이클별):

| Cycle | Coefficient |
|---|---|
| 1 | 0.925 |
| 2 | 0.95 |
| 3 | 0.975 |
| 4 | 0.85 |

**Session Coefficient** (세션·리프트·세트별):

세션 A:
| Lift | Sets × Reps | Session Coef |
|---|---|---|
| SQ | 4 × 3 | 0.875 |
| BP | 4 × 5 | 0.775 |
| WPU | 4 × 3 | 0.85 |

세션 B:
| Lift | Sets × Reps | Session Coef |
|---|---|---|
| SQ | 5 × 5 | 0.70 |
| DL | 3 × 3 | 0.80 |
| WPU | 3 × 6-8 | 0.65 |

세션 C:
| Lift | Sets × Reps | Session Coef |
|---|---|---|
| SQ | 6 × 3 | 0.75 |
| BP | 4 × 3 | 0.85 |
| OHP | 4 × 5 | 0.75 |

### 5.3 계산 예시

**입력**: SQ TM = 95kg, Cycle 2, Session A

```
WorkingWeight = 95 × 0.95 × 0.875 = 78.97 kg
DisplayWeight = floor(78.97 / 2.5) × 2.5 = 77.5 kg
→ 스쿼트 4 sets × 3 reps @ 77.5 kg
```

**입력**: SQ TM = 95kg, Cycle 3, Session A (AMRAP 사이클)

```
WorkingWeight = 95 × 0.975 × 0.875 = 81.05 kg
DisplayWeight = 80 kg
→ 스쿼트 3 sets × 3 reps @ 80 kg + 마지막 세트 AMRAP @ 80 kg
```

### 5.4 풀업 가중치 계산

중량풀업은 **(BW + 추중량)** 으로 계산:

```
EffectiveWeight = BW + AddedWeight
WorkingWeight = WPU_TM × CycleCoef × SessionCoef

AddedWeight = WorkingWeight - BW
DisplayAddedWeight = floor(AddedWeight / 2.5) × 2.5
```

**예시**: WPU TM = 105kg (BW 73 + 32kg), BW = 73kg, Cycle 2, Session A
```
WorkingWeight = 105 × 0.95 × 0.85 = 84.79 kg
AddedWeight = 84.79 - 73 = 11.79 kg
DisplayAddedWeight = 10 kg
→ 중량풀업 4 sets × 3 reps @ +10kg
```

만약 AddedWeight < 0 (즉, BW만 들기에도 무거우면) → **밴드 보조 풀업** 또는 **네거티브 풀업**으로 대체. (앱 UI에서 안내 메시지)

---

## 6. 세션 상세

### 6.1 세션 A — 강도 중심

**리프트 순서**:
1. 스쿼트
2. 벤치프레스
3. 중량풀업

**세부**:

| 리프트 | 세트 × 렙 | TM % (세션 계수) | 휴식 | 비고 |
|---|---|---|---|---|
| SQ | 4 × 3 | 87.5% | 3-5분 | 사이클 3 마지막 세트: AMRAP |
| BP | 4 × 5 | 77.5% | 2-3분 | AMRAP 없음 |
| WPU | 4 × 3 | 85% | 2-3분 | 사이클 3 마지막 세트: AMRAP |

**예상 소요**: 60-75분

### 6.2 세션 B — 볼륨 + 풀

**리프트 순서**:
1. 스쿼트
2. 데드리프트
3. 중량풀업

| 리프트 | 세트 × 렙 | TM % | 휴식 | 비고 |
|---|---|---|---|---|
| SQ | 5 × 5 | 70% | 2-3분 | Sets across, 빠른 페이스 |
| DL | 3 × 3 | 80% | 3분 | **절대 실패 X**, 폼 깨지면 즉시 종료 |
| WPU | 3 × 6-8 | 65% | 2분 | 모든 세트 같은 무게 |

**예상 소요**: 50-65분

### 6.3 세션 C — 스피드 + 프레스

**리프트 순서**:
1. 스쿼트 (스피드)
2. 벤치프레스
3. 오버헤드프레스

| 리프트 | 세트 × 렙 | TM % | 휴식 | 비고 |
|---|---|---|---|---|
| SQ | 6 × 3 | 75% | 60-90초 | **폭발적 컨센트릭**, 휴식 짧게 |
| BP | 4 × 3 | 85% | 3분 | 사이클 3 마지막 세트: AMRAP |
| OHP | 4 × 5 | 75% | 2-3분 | AMRAP 없음 |

**예상 소요**: 50-65분

---

## 7. AMRAP 프로토콜

### 7.1 발동 조건

- **사이클 3에서만**
- **메인 3개 리프트만**: SQ, BP, WPU
- **마지막 워크 세트에서만**

AMRAP 미발동 대상:
- 사이클 1, 2, 4
- DL, OHP (보조 리프트)
- 메인 3개 리프트의 1~3번째 세트

### 7.2 AMRAP 위치

| 리프트 | AMRAP 세션 | AMRAP 세트 | TM × Cycle × Session |
|---|---|---|---|
| SQ | Session A | 4번째 세트 | TM × 0.975 × 0.875 = 85.3% TM |
| BP | Session C | 4번째 세트 | TM × 0.975 × 0.85 = 82.9% TM |
| WPU | Session A | 4번째 세트 | TM × 0.975 × 0.85 = 82.9% TM |

### 7.3 수행 규칙

1. 마지막 워크 세트를 평소처럼 시작
2. 폼이 무너지지 않는 한도까지 반복
3. **RPE 9 한도**: 1렙 더 가능한 시점에서 종료 (실패까지 가지 않음)
4. 기록: 완수한 렙 수

### 7.4 AMRAP 결과 → TM 변동

각 리프트 **독립적**으로 계산:

| AMRAP 렙수 | 다음 블록 TM 변동 | 의미 |
|---|---|---|
| ≥ 8 | **+2.5kg** | 충분히 벌었음 |
| 5-7 | **유지** | 동일 TM으로 한 블록 더 |
| 3-4 | **−2.5kg** | 살짝 무리, 후퇴 |
| ≤ 2 | **−5kg + 다음 블록 light** | 회복 부족 신호 |

**기준 렙수의 근거**:
- 4×3 세트의 마지막 AMRAP에서 5렙 = "프로그래밍된 무게가 적정"
- 8렙 이상 = "여유 있음, 인상 가능"
- 3렙 이하 = "TM이 과대평가됨"

### 7.5 부분 실패 처리

3개 리프트 중 일부만 AMRAP 미달:
- **각 리프트 독립 처리**. SQ는 +2.5kg, BP는 유지, WPU는 −2.5kg 가능.

---

## 8. 증량 프로토콜

### 8.1 메인 리프트 (SQ, BP, WPU) 증량

**블록 종료 후 AMRAP 기반** (7.4 표 참조).

증량 단위: **2.5kg**.

### 8.2 보조 리프트 (DL, OHP) 증량

**메인 리프트와 연동**:

```python
# Pseudocode
def update_aux_tms(new_sq_tm, new_bp_tm):
    new_dl_tm = new_sq_tm  # 항상 SQ TM 추적
    new_ohp_tm = floor(new_bp_tm * 0.5 / 2.5) * 2.5  # BP TM × 50% 추적
    return new_dl_tm, new_ohp_tm
```

DL TM은 SQ TM과 동일하게 이동.
OHP TM은 BP TM의 50%를 추적 (2.5kg 라운딩).

### 8.3 증량 속도

- **이상적 페이스**: 한 블록(약 1-2개월)당 메인 리프트 1개 +2.5kg
- **연 평균**: 메인 리프트 약 +15~25kg (영양/회복 상태에 따라)
- 절대로 5kg 이상 한 번에 인상하지 않음

### 8.4 풀업 증량 특수성

중량풀업은 **BW + 추중량**으로 강도가 결정되므로:
- BW 변동 시 WPU TM 재계산 필요 (10.3 참조)
- 추중량이 음수가 되면 (즉, BW만 들기도 무거우면) 밴드 보조로 전환

---

## 9. 실패 & 디로드 프로토콜

### 9.1 사이클 4 (자동 디로드)

매 블록 마지막 사이클은 자동 디로드:
- TM 계수 0.85 적용
- AMRAP 없음
- 정상 세트 × 렙 그대로 수행
- 회복 누적 해소 목적

### 9.2 블록 내 실패 (세트 미달)

**정상 세트 미달 시 (예: 5×5 중 3번째 세트에서 5렙 못 채움)**:

1. 첫 발생: 세트 줄여서 완료 (예: 4세트로 줄임)
2. 같은 사이클에서 또 발생: 그 사이클 디로드로 처리, 다음 사이클은 빌드 사이클(=Cycle 2)부터 재시작
3. 연속 2 사이클 발생: 즉시 블록 종료, 디로드 사이클로 점프

### 9.3 AMRAP 저조 (≤ 2 렙)

블록 종료 후 처리:
1. 해당 리프트 TM **−5kg**
2. 다음 블록은 **모든 리프트 light**: Cycle 1 계수를 0.925 → 0.85로 추가 하향
3. 그 다음 블록부터 정상 진행

### 9.4 연속 정체 (TM이 2 블록 이상 안 오름)

진단:
1. 영양/수면 점검 (가장 흔한 원인)
2. BW 변동 확인 (5kg 이상 변화 시 TM 재설정)
3. 컨디셔닝 빈도 확인 (클라이밍 등이 너무 잦으면 회복 부족)

조치 (순차 적용):
1. 1차: TM 5% 일괄 다운, 한 블록 재진행
2. 2차: 사이클 3의 계수를 0.975 → 0.95로 하향, 안전 마진 확보
3. 3차: 블록당 사이클을 4 → 5로 늘림 (빌드 사이클 1개 추가)

### 9.5 강제 디로드 트리거

다음 조건 중 하나라도 충족 시 즉시 디로드(Cycle 4) 점프:
- 정상 세트 미달 2회 연속 (9.2)
- AMRAP 결과 모든 메인 리프트 ≤ 3렙
- 사용자가 직접 "디로드 필요" 신고

---

## 10. 특수 상황 대응

### 10.1 클라이밍 + 운동 일정 충돌

| 클라이밍 후 시간 | 다음 세션 권장 |
|---|---|
| < 24h | Session C (스쿼트 스피드, 풀업 없음) |
| 24-48h | Session A 또는 정상 진행 |
| > 48h | 정상 진행 |

**이유**: 클라이밍은 상체 풀 + 코어 + 그립 자극. 풀업이 있는 세션 A, B는 직후 회피.

### 10.2 장기 휴식 (3일 이상)

휴식 일수에 따라:
- 3-5일: 정상 다음 세션 진행
- 6-10일: 현재 사이클 처음부터 다시 시작
- 11일~3주: 한 사이클 이전부터 재개 (예: Cycle 3 중이었다면 Cycle 2부터)
- 3주 이상: 현재 블록 폐기, TM × 0.95로 새 블록 시작

### 10.3 BW 변동 5kg 이상

중량풀업의 강도는 (BW + 추중량)이므로 BW 변동이 직접 영향:

```python
# BW 증가 시 (예: 70 → 75kg)
새_WPU_TM = 기존_WPU_TM + (새_BW - 기존_BW)

# BW 감소 시 (예: 75 → 70kg)
새_WPU_TM = 기존_WPU_TM + (새_BW - 기존_BW)  # 음수 합산
```

스쿼트/벤치/DL/OHP는 BW 영향 적지만, **5kg 이상 변동 시 절대 1RM이 변할 수 있으므로 다음 블록에서 AMRAP 재검증으로 자연 보정**.

### 10.4 컨디션 박살난 세션 (긴급 다운로드)

세션 직전 컨디션 인식 → 자가 조정:

1. **전체 무게 × 0.95** 적용
2. 그래도 무거우면 마지막 세트 1-2개 빼기
3. AMRAP 사이클이면 AMRAP 스킵, 일반 세트로 수행
4. 그래도 안 되면 세션 스킵, 다음 운동일에 같은 세션 재시도

### 10.5 부상 회피

리프트별 처리:
- **SQ 부상**: 프로그램 일시 중단. 재활 후 TM 70%로 재시작.
- **BP 부상**: 세션 A의 BP를 OHP로 대체 가능 (단, OHP 캡 무시 가능 임시)
- **WPU 부상**: 일반 풀업으로 대체, TM은 BW로 설정
- **DL 부상**: DL 스킵, 세션 B는 SQ + WPU만 수행
- **OHP 부상**: OHP 스킵, 세션 C는 SQ + BP만 수행

---

## 11. 세션 흐름

### 11.1 세션 시작 전 (앱 화면 흐름)

1. **상태 표시**: 현재 블록 #N, 사이클 #M, 다음 세션 (A/B/C)
2. **컨디션 체크 (선택)**: "오늘 컨디션 어때요?" (좋음/보통/나쁨)
   - 나쁨 선택 시: 10.4 자동 조정 옵션 제시
3. **TM 표시**: 5개 리프트 현재 TM 확인 가능
4. **세션 시작** 버튼

### 11.2 세션 중 흐름

각 리프트별로:
1. **무게 표시** (계산된 작업 무게)
2. **세트 카운터** (1/4, 2/4, ...)
3. **렙 입력** (목표 렙 자동 표시, 사용자가 실제 완수 렙 입력)
4. **AMRAP 표시** (해당하는 세션·사이클·세트만 강조)
5. **휴식 타이머** (자동 시작)

### 11.3 세션 종료 후

1. **세션 요약**: 완수 리프트, 총 볼륨, AMRAP 결과
2. **다음 세션 안내**: 다음 세션 식별자 표시
3. **노트 입력** (선택): 컨디션, 폼 이슈 등

### 11.4 블록 종료 후 (사이클 4 완료 시)

1. **블록 요약 리포트**:
   - 사이클 3 AMRAP 결과 (3개 리프트)
   - 각 리프트별 TM 변동 제안
2. **TM 업데이트 확인** (사용자 승인 또는 자동 적용)
3. **새 블록 시작**

---

## 12. 앱 구현 가이드

### 12.1 데이터 모델

#### User
```typescript
interface User {
  id: string;
  bodyweight: number;  // kg
  bodyweightUpdatedAt: Date;
  startedAt: Date;
}
```

#### TrainingMax
```typescript
interface TrainingMax {
  userId: string;
  lift: 'SQ' | 'BP' | 'WPU' | 'DL' | 'OHP';
  value: number;       // kg
  updatedAt: Date;
  blockId: string;     // 어느 블록에서 설정/업데이트되었는지
}
```

#### Block
```typescript
interface Block {
  id: string;
  userId: string;
  blockNumber: number;
  startedAt: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'aborted';
  initialTMs: { SQ: number; BP: number; WPU: number; DL: number; OHP: number; };
  amrapResults?: { SQ: number; BP: number; WPU: number; };
  tmUpdates?: { SQ: number; BP: number; WPU: number; };  // delta values
}
```

#### Session
```typescript
interface Session {
  id: string;
  blockId: string;
  cycleNumber: 1 | 2 | 3 | 4;
  sessionType: 'A' | 'B' | 'C';
  sequenceIndex: number;  // 0-11 (블록 내 순서)
  performedAt: Date;
  bodyweight: number;     // 세션 시점 BW
  lifts: LiftPerformance[];
  notes?: string;
  conditionRating?: 'good' | 'normal' | 'poor';
}
```

#### LiftPerformance
```typescript
interface LiftPerformance {
  lift: 'SQ' | 'BP' | 'WPU' | 'DL' | 'OHP';
  prescribedWeight: number;
  actualWeight: number;
  sets: SetPerformance[];
}

interface SetPerformance {
  setNumber: number;
  prescribedReps: number;
  actualReps: number;
  isAMRAP: boolean;
}
```

### 12.2 상태 머신

블록 내 진행 상태:

```
[Block Start]
    ↓
[Cycle 1] → A → B → C ─┐
                       ↓
[Cycle 2] → A → B → C ─┤
                       ↓
[Cycle 3] → A → B → C ─┤  (AMRAP enabled)
                       ↓
[Cycle 4] → A → B → C ─┤
                       ↓
[Block End: Compute TM updates]
                       ↓
[New Block]
```

### 12.3 핵심 계산 함수 (TypeScript Pseudocode)

```typescript
// 무게 계산
function calculateWorkingWeight(
  tm: number,
  cycle: 1 | 2 | 3 | 4,
  sessionType: 'A' | 'B' | 'C',
  lift: Lift
): number {
  const cycleCoef = CYCLE_COEFFICIENTS[cycle];
  const sessionCoef = SESSION_COEFFICIENTS[sessionType][lift];
  if (sessionCoef === undefined) return null;  // 해당 세션에 없는 리프트
  const rawWeight = tm * cycleCoef * sessionCoef;
  return Math.floor(rawWeight / 2.5) * 2.5;
}

// 풀업 추중량 계산
function calculatePullupAddedWeight(
  wpuTm: number,
  bw: number,
  cycle: number,
  sessionType: 'A' | 'B' | 'C'
): number {
  const totalWeight = calculateWorkingWeight(wpuTm, cycle, sessionType, 'WPU');
  const added = totalWeight - bw;
  return Math.floor(added / 2.5) * 2.5;  // 음수 가능
}

// AMRAP 결과 → 다음 TM 결정
function determineNextTM(
  currentTM: number,
  amrapReps: number
): { newTM: number; nextBlockMode: 'normal' | 'light' } {
  if (amrapReps >= 8) {
    return { newTM: currentTM + 2.5, nextBlockMode: 'normal' };
  } else if (amrapReps >= 5) {
    return { newTM: currentTM, nextBlockMode: 'normal' };
  } else if (amrapReps >= 3) {
    return { newTM: currentTM - 2.5, nextBlockMode: 'normal' };
  } else {
    return { newTM: currentTM - 5, nextBlockMode: 'light' };
  }
}

// 보조 리프트 TM 도출
function deriveAuxTMs(sqTM: number, bpTM: number): { dlTM: number; ohpTM: number } {
  const dlTM = sqTM;
  const ohpTM = Math.floor((bpTM * 0.5) / 2.5) * 2.5;
  return { dlTM, ohpTM };
}

// 블록 종료 처리
function completeBlock(block: Block, amrapResults: AmrapResults): TMUpdates {
  const sqUpdate = determineNextTM(block.initialTMs.SQ, amrapResults.SQ);
  const bpUpdate = determineNextTM(block.initialTMs.BP, amrapResults.BP);
  const wpuUpdate = determineNextTM(block.initialTMs.WPU, amrapResults.WPU);
  
  const { dlTM: newDL, ohpTM: newOHP } = deriveAuxTMs(sqUpdate.newTM, bpUpdate.newTM);
  
  return {
    SQ: sqUpdate.newTM,
    BP: bpUpdate.newTM,
    WPU: wpuUpdate.newTM,
    DL: newDL,
    OHP: newOHP,
    nextBlockMode: anyLight([sqUpdate, bpUpdate, wpuUpdate]) ? 'light' : 'normal'
  };
}

// 다음 세션 결정
function getNextSession(block: Block): { cycle: number; sessionType: string } {
  const completedCount = block.completedSessions.length;
  const cycle = Math.floor(completedCount / 3) + 1;  // 1-4
  const sessionInCycle = completedCount % 3;
  const sessionType = ['A', 'B', 'C'][sessionInCycle];
  return { cycle, sessionType };
}
```

### 12.4 상수 테이블

```typescript
const CYCLE_COEFFICIENTS = {
  1: 0.925,
  2: 0.95,
  3: 0.975,
  4: 0.85
};

const LIGHT_BLOCK_CYCLE_COEFFICIENTS = {
  1: 0.85,
  2: 0.9,
  3: 0.925,
  4: 0.80
};

const SESSION_COEFFICIENTS = {
  A: { SQ: 0.875, BP: 0.775, WPU: 0.85 },
  B: { SQ: 0.70, DL: 0.80, WPU: 0.65 },
  C: { SQ: 0.75, BP: 0.85, OHP: 0.75 }
};

const SETS_REPS = {
  A: { 
    SQ: { sets: 4, reps: 3, amrap: true },
    BP: { sets: 4, reps: 5, amrap: false },
    WPU: { sets: 4, reps: 3, amrap: true }
  },
  B: { 
    SQ: { sets: 5, reps: 5, amrap: false },
    DL: { sets: 3, reps: 3, amrap: false },
    WPU: { sets: 3, reps: 8, amrap: false }  // 6-8 범위, 8을 표시
  },
  C: { 
    SQ: { sets: 6, reps: 3, amrap: false },
    BP: { sets: 4, reps: 3, amrap: true },
    OHP: { sets: 4, reps: 5, amrap: false }
  }
};
```

### 12.5 AMRAP 활성화 조건

```typescript
function shouldAMRAP(
  cycle: number,
  sessionType: 'A' | 'B' | 'C',
  lift: Lift,
  setNumber: number,
  totalSets: number
): boolean {
  if (cycle !== 3) return false;
  if (setNumber !== totalSets) return false;  // 마지막 세트만
  
  const amrapMap = {
    A: { SQ: true, WPU: true },
    C: { BP: true }
  };
  return amrapMap[sessionType]?.[lift] === true;
}
```

### 12.6 UI 권장 사항

**세션 진행 화면**:
- 큰 글씨로 작업 무게 표시
- 휴식 타이머 자동 시작 (해당 리프트 권장 휴식 시간)
- AMRAP 세트는 빨간색/강조 표시
- "예상 렙 수" 안내 (TM 기준 5렙 = 적정)

**TM 관리 화면**:
- 5개 리프트 모두 표시
- DL, OHP는 "(자동 도출됨)" 라벨
- 사용자 오버라이드 가능 (단, 상한 검증)
- TM 변동 히스토리 그래프

**블록 종료 리포트**:
- AMRAP 결과 3개 리프트 표시
- 각 리프트 다음 TM 제안 (변동 사유 함께)
- "수락" 또는 "수동 조정" 옵션

---

## 13. 예시 시나리오

### 13.1 첫 블록 시작 (초기 설정)

**사용자**: BW 73kg, 최근 스쿼트 5RM 90kg, 벤치 5RM 70kg, 풀업 +20kg × 5렙

**TM 계산**:
- SQ TM = 90 × 1.05 = 94.5 → **92.5kg** (라운딩 다운)
- BP TM = 70 × 1.05 = 73.5 → **72.5kg**
- WPU TM = (73 + 20) × 1.05 = 97.65 → **97.5kg** (이 중 BW 73kg, 추중량 24.5kg)
- DL TM = SQ TM = **92.5kg**
- OHP TM = floor(72.5 × 0.5 / 2.5) × 2.5 = **35kg**

**Block 1, Cycle 1, Session A** (시작):
- SQ: 92.5 × 0.925 × 0.875 = 74.9 → **72.5kg × 4×3**
- BP: 72.5 × 0.925 × 0.775 = 51.97 → **50kg × 4×5**
- WPU: 97.5 × 0.925 × 0.85 = 76.66 → **75kg × 4×3** (추중량 = 75 - 73 = +2.5kg)

### 13.2 정상 진행 (블록 1 → 블록 2)

**Cycle 3, Session A AMRAP 결과**:
- SQ AMRAP @ 80kg: **8 렙**
- WPU AMRAP @ 80kg (BW 73, 추중량 7.5kg): **9 렙**

**Cycle 3, Session C AMRAP 결과**:
- BP AMRAP @ 60kg: **6 렙**

**Block 2 TM**:
- SQ: 92.5 + 2.5 = **95kg**
- BP: 72.5 + 0 = **72.5kg** (유지)
- WPU: 97.5 + 2.5 = **100kg**
- DL: 95kg (SQ 따라감)
- OHP: floor(72.5 × 0.5 / 2.5) × 2.5 = **35kg** (유지)

### 13.3 정체 케이스 (블록 3 AMRAP 저조)

**Block 3 결과**:
- SQ AMRAP: 3 렙 → −2.5kg
- BP AMRAP: 5 렙 → 유지
- WPU AMRAP: 2 렙 → −5kg + light 블록

**Block 4 처리**:
- SQ TM: 95 → **92.5kg**
- BP TM: 72.5 (유지)
- WPU TM: 100 → **95kg**
- **Block 4 = Light Block**: LIGHT_BLOCK_CYCLE_COEFFICIENTS 적용
- 사용자에게 알림: "회복 부족 신호. 영양/수면 점검 권장."

### 13.4 BW 변동 케이스

**사용자가 다이어트로 BW 73 → 68kg (−5kg)**:

WPU TM 조정:
- 기존 WPU TM = 100kg (BW 73 + 추중량 27kg)
- 새 WPU TM = 100 + (68 - 73) = **95kg** (BW 68 + 추중량 27kg, 추중량은 유지)

스쿼트/벤치/DL/OHP는 즉시 조정 없음. 다음 블록 AMRAP에서 자연스럽게 보정.

### 13.5 클라이밍 후 세션

**금요일 클라이밍 후 토요일 운동 (24시간 이내)**:
- 원래 다음 세션: B (스쿼트 볼륨 + DL + 풀업 볼륨)
- **조정**: Session C로 스왑 (스쿼트 스피드 + 벤치 강도 + OHP, 풀업 없음)
- 다음 세션에서 Session B 수행

---

## 14. FAQ

### Q1. 왜 TM × 0.83인가? 일반적으로 0.9 아닌가?

**A**: 회복이 불안정한 사용자 대상이라 안전 마진을 더 둠. 일반 5/3/1의 0.9 TM은 정상 영양·수면 가정. Asymptote는 그 가정 없음. 첫 블록이 가볍게 느껴져야 정상 — 4 사이클 누적 후에도 안 막힘.

### Q2. 왜 2.5kg씩만 올리나? 5kg 올리면 더 빠르지 않나?

**A**: 정체 패턴이 있는 사용자에게 5kg는 한 번에 너무 큼. 2.5kg는 "거의 못 느끼는" 증량이지만 누적되면 6개월에 15kg, 1년이면 30kg. 정체보다 훨씬 나음.

### Q3. AMRAP에서 5렙 미만이면 그 세션은 망친 건가?

**A**: 아니. 5렙은 다음 블록 TM 결정용 기준일 뿐. 그 세션 자체는 무사히 끝낸 것. 다음 블록에서 TM 조정으로 재정렬.

### Q4. 사이클 3에서 AMRAP 12렙 이상이면 +5kg 올려도 되나?

**A**: 권장 X. 2.5kg 룰 유지. 12렙 이상이면 시작 TM이 너무 낮았을 가능성. 다음 블록에서도 또 8+렙 나오면 자연스럽게 누적 인상됨.

### Q5. 풀업 추중량이 음수가 나오면?

**A**: 즉 BW만 들기에도 무거운 상태. 처리:
1. 밴드 보조 풀업으로 대체
2. 네거티브 풀업 (이심성 4초)
3. TM을 BW로 재설정하고 추중량 0부터 시작

### Q6. 보조 운동 추가하면 안 되나?

**A**: 이 프로그램의 핵심 제약. 추가 시 회복 분산 → 메인 5개 진행 손상. 절대 추가 X. 보조 운동이 필요하면 다른 프로그램 사용.

### Q7. 클라이밍 외 다른 컨디셔닝은?

**A**: 추가 가능. 단:
- 강도 낮음 (조깅, 가벼운 자전거 등): 영향 적음
- 강도 높음 (HIIT, 인터벌 등): 회복 큰 부담. 운동 빈도 줄여야 함

### Q8. 대회 준비할 수 있나?

**A**: 권장 X. 점근선 원리상 TM 100%에 도달하지 않으므로 진성 1RM 피킹 불가. 대회 6-8주 전에 Calgary, RTS 등 피킹 프로그램으로 전환 권장.

### Q9. 며칠에 한 번 운동해야 하나?

**A**: 정해진 빈도 없음. 자기 회복 허용 범위 내에서 자유. 권장 가이드:
- 주 2회: 2주에 1 사이클 (블록 1개 = 약 2개월)
- 주 3회: 1주에 1 사이클 (블록 1개 = 약 4주)
- 주 4회 이상: 회복 가능하면 OK, 단 클라이밍 등 컨디셔닝 고려

### Q10. 다른 프로그램과 비교한 진행 속도?

**A**:

| 프로그램 | 메인 리프트 연 증가 (대략) |
|---|---|
| Starting Strength (초보) | +40~80kg (초기 효과) |
| 5/3/1 (Wendler) | +15~30kg |
| nSuns | +15~25kg (회복 OK 시) |
| TB Operator | +10~20kg |
| **Asymptote Protocol** | **+15~25kg (정체 없이)** |

빠르지 않다. 대신 **벽 안 만남**.

---

## 부록 A: 빠른 참조

### A.1 주요 계수
```
Cycle 1: 0.925
Cycle 2: 0.95
Cycle 3: 0.975 (+ AMRAP)
Cycle 4: 0.85  (deload)

Session A: SQ 0.875×4×3, BP 0.775×4×5, WPU 0.85×4×3
Session B: SQ 0.70×5×5, DL 0.80×3×3, WPU 0.65×3×8
Session C: SQ 0.75×6×3, BP 0.85×4×3, OHP 0.75×4×5
```

### A.2 AMRAP 결정 매트릭스
```
AMRAP ≥ 8  : TM + 2.5kg
AMRAP 5-7  : TM 유지
AMRAP 3-4  : TM - 2.5kg
AMRAP ≤ 2  : TM - 5kg + 다음 블록 light
```

### A.3 보조 리프트 도출
```
DL_TM  = SQ_TM
OHP_TM = floor(BP_TM × 0.5 / 2.5) × 2.5
```

### A.4 라운딩 규칙
```
DisplayWeight = floor(WorkingWeight / 2.5) × 2.5
```

---

## 부록 B: 버전 히스토리

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-05-18 | 초안. 3-세션 로테이션, 4-사이클 블록, AMRAP 게이팅. |

---

**Asymptote Protocol** — 천장에 닿지 않는 한, 벽도 없다.
