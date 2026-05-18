# Asymptote Protocol — 로직 테스트 가이드

> 앱 구현 로직 검증용. 입력→예상출력 페어 + 시나리오 워크스루.

---

## 1. 핵심 로직 한눈에

```
[블록 시작] → [Cycle 1 (A→B→C)] → [Cycle 2 (A→B→C)] → [Cycle 3 (A→B→C) + AMRAP] → [Cycle 4 (A→B→C) 디로드]
   ↑                                                                                        ↓
   └─────────── [TM 업데이트 (AMRAP 결과 기반)] ←────────────────────────────────────────────┘
```

**불변식**:
- TM 자동 증가 X. AMRAP 결과로만 변경.
- 실제 작업 무게는 항상 TM 미만 (최대 0.975 × TM × 0.875 ≈ 0.853 × TM).
- DL_TM = SQ_TM, OHP_TM = floor(BP_TM × 0.5 / 2.5) × 2.5 (자동 도출).

---

## 2. 상태 머신

### 2.1 세션 순서 (sequenceIndex 0-11)

| seqIdx | Cycle | Session | AMRAP? |
|---|---|---|---|
| 0 | 1 | A | X |
| 1 | 1 | B | X |
| 2 | 1 | C | X |
| 3 | 2 | A | X |
| 4 | 2 | B | X |
| 5 | 2 | C | X |
| 6 | 3 | A | **✓ (SQ, WPU)** |
| 7 | 3 | B | X |
| 8 | 3 | C | **✓ (BP)** |
| 9 | 4 | A | X |
| 10 | 4 | B | X |
| 11 | 4 | C | X |

**공식**:
```
cycle = floor(seqIdx / 3) + 1
sessionType = ['A', 'B', 'C'][seqIdx % 3]
```

### 2.2 블록 전환 트리거

```
세션 11 (Cycle 4, Session C) 완료 → 블록 종료 → TM 업데이트 → 새 블록 (seqIdx=0)
```

---

## 3. 계산 로직 테스트

### 3.1 무게 계산: `calculateWorkingWeight(tm, cycle, session, lift)`

**공식**: `floor(tm × cycleCoef × sessionCoef / 2.5) × 2.5`

| TM | Cycle | Session | Lift | 기대 출력 | 검증 식 |
|---|---|---|---|---|---|
| 100 | 1 | A | SQ | **80.0** | 100 × 0.925 × 0.875 = 80.94 → 80 |
| 100 | 2 | A | SQ | **82.5** | 100 × 0.95 × 0.875 = 83.13 → 82.5 |
| 100 | 3 | A | SQ | **85.0** | 100 × 0.975 × 0.875 = 85.31 → 85 |
| 100 | 4 | A | SQ | **72.5** | 100 × 0.85 × 0.875 = 74.38 → 72.5 |
| 100 | 1 | B | SQ | **65.0** | 100 × 0.925 × 0.70 = 64.75 → 62.5 ⚠ |
| 100 | 3 | B | SQ | **67.5** | 100 × 0.975 × 0.70 = 68.25 → 67.5 |
| 100 | 1 | C | SQ | **67.5** | 100 × 0.925 × 0.75 = 69.38 → 67.5 |
| 100 | 3 | C | BP | **82.5** | 100 × 0.975 × 0.85 = 82.88 → 82.5 |
| 100 | 1 | A | BP | **70.0** | 100 × 0.925 × 0.775 = 71.69 → 70 |
| 100 | 1 | A | WPU | **78.5** ⚠ | 100 × 0.925 × 0.85 = 78.63 → 77.5 |
| 100 | 1 | C | OHP | **67.5** | 100 × 0.925 × 0.75 = 69.38 → 67.5 |
| 92.5 | 1 | A | SQ | **72.5** | 92.5 × 0.925 × 0.875 = 74.87 → 72.5 |

> ⚠ 표시는 직접 계산 후 확인 (라운딩 경계).

### 3.2 풀업 추중량: `calculatePullupAddedWeight(wpuTM, bw, cycle, session)`

| WPU TM | BW | Cycle | Session | 작업무게 | 추중량 |
|---|---|---|---|---|---|
| 100 | 73 | 1 | A | 77.5 | **+2.5** |
| 100 | 73 | 3 | A | 82.5 | **+7.5** |
| 100 | 73 | 1 | B | 60.0 | **−12.5** (밴드 보조 필요) |
| 80 | 73 | 1 | A | 62.5 | **−10** (밴드 보조) |
| 110 | 70 | 3 | A | 90.0 | **+20** |

**음수 처리**: 추중량 < 0 → UI에서 "밴드 보조 풀업" 안내.

### 3.3 보조 TM 도출: `deriveAuxTMs(sqTM, bpTM)`

| SQ TM | BP TM | DL TM | OHP TM | 검증 |
|---|---|---|---|---|
| 95 | 70 | **95** | **35** | floor(70 × 0.5 / 2.5) × 2.5 = 35 |
| 100 | 75 | **100** | **37.5** | floor(37.5 / 2.5) × 2.5 = 37.5 |
| 100 | 77.5 | **100** | **37.5** | floor(38.75 / 2.5) × 2.5 = 37.5 |
| 100 | 82.5 | **100** | **40** | floor(41.25 / 2.5) × 2.5 = 40 |
| 80 | 60 | **80** | **30** | — |

---

## 4. AMRAP & 결정 로직 테스트

### 4.1 AMRAP 활성화: `shouldAMRAP(cycle, session, lift, setNum, totalSets)`

| Cycle | Session | Lift | Set | Total | 기대 |
|---|---|---|---|---|---|
| 1 | A | SQ | 4 | 4 | **false** (Cycle ≠ 3) |
| 3 | A | SQ | 1 | 4 | **false** (last set 아님) |
| 3 | A | SQ | 4 | 4 | **true** |
| 3 | A | WPU | 4 | 4 | **true** |
| 3 | A | BP | 4 | 4 | **false** (A의 BP는 AMRAP X) |
| 3 | B | SQ | 5 | 5 | **false** (B에는 AMRAP 없음) |
| 3 | C | BP | 4 | 4 | **true** |
| 3 | C | SQ | 6 | 6 | **false** (C의 SQ는 AMRAP X) |
| 3 | C | OHP | 4 | 4 | **false** (OHP는 AMRAP X) |
| 2 | A | SQ | 4 | 4 | **false** (Cycle ≠ 3) |

### 4.2 TM 업데이트: `determineNextTM(currentTM, amrapReps)`

| currentTM | reps | newTM | nextBlockMode |
|---|---|---|---|
| 100 | 10 | **102.5** | normal |
| 100 | 8 | **102.5** | normal |
| 100 | 7 | **100** | normal |
| 100 | 5 | **100** | normal |
| 100 | 4 | **97.5** | normal |
| 100 | 3 | **97.5** | normal |
| 100 | 2 | **95** | **light** |
| 100 | 1 | **95** | **light** |
| 100 | 0 | **95** | **light** |

### 4.3 블록 종료 처리: 다중 리프트 독립

**입력**: SQ AMRAP=8, BP AMRAP=4, WPU AMRAP=10

| 리프트 | 현재 TM | AMRAP | 다음 TM |
|---|---|---|---|
| SQ | 95 | 8 | **97.5** |
| BP | 72.5 | 4 | **70** |
| WPU | 100 | 10 | **102.5** |
| DL | 95 | — | **97.5** (SQ 따라감) |
| OHP | 35 | — | **35** (floor(70×0.5/2.5)×2.5=35) |

**검증**: BP가 light 모드 트리거 안 함 (≥3렙). 한 리프트라도 ≤2렙이면 nextBlockMode = light.

---

## 5. 엔드투엔드 시나리오

### 시나리오 1: 첫 블록 정상 진행

**초기 상태**:
```
User: BW=73, 시작일=Today
TMs: SQ=92.5, BP=72.5, WPU=97.5, DL=92.5, OHP=35
```

**Session 0 (Block 1, Cycle 1, Session A)**:
- SQ: 92.5 × 0.925 × 0.875 = 74.87 → **72.5kg × 4×3** (AMRAP=false)
- BP: 92.5(❌ BP TM=72.5) × 0.925 × 0.775 = 51.97 → **50kg × 4×5**
- WPU: 97.5 × 0.925 × 0.85 = 76.66 → 75.0 / 추중량 = **+2.5kg × 4×3**

> 테스트: TM 잘못 매핑하면 안 됨. 각 리프트는 자기 TM 사용.

**Session 6 (Block 1, Cycle 3, Session A)**:
- SQ: 92.5 × 0.975 × 0.875 = 78.91 → **77.5kg × 4×3**, **마지막 세트 AMRAP**
- BP: 72.5 × 0.975 × 0.775 = 54.78 → **52.5kg × 4×5** (AMRAP X)
- WPU: 97.5 × 0.975 × 0.85 = 80.81 → 80.0 / 추중량 = **+7.5kg × 4×3**, **마지막 세트 AMRAP**

**Session 8 (Block 1, Cycle 3, Session C)**:
- BP: 72.5 × 0.975 × 0.85 = 60.10 → **60kg × 4×3**, **마지막 세트 AMRAP**

**AMRAP 결과 입력**:
- SQ @ 77.5kg: 7렙
- WPU @ +7.5kg: 9렙
- BP @ 60kg: 6렙

**Block 2 TM 계산**:
- SQ: 92.5 + 0 = **92.5** (5-7렙)
- BP: 72.5 + 0 = **72.5** (5-7렙)
- WPU: 97.5 + 2.5 = **100** (8+렙)
- DL: 92.5 (SQ 따라감)
- OHP: floor(72.5×0.5/2.5)×2.5 = **35**

> 테스트 포인트:
> - SQ TM 안 올라간 게 정상 (7렙은 유지 범위)
> - WPU만 인상
> - DL = SQ (변경 없음)
> - OHP = BP × 0.5 라운딩 = 35 (변경 없음)
> - nextBlockMode = normal (모두 ≥3렙)

### 시나리오 2: 정체 → light 블록

**Block N AMRAP**:
- SQ: 1렙 (≤2)
- BP: 4렙
- WPU: 5렙

**다음 블록 처리**:
- SQ TM: −5 → SQ light mode 트리거
- BP TM: −2.5
- WPU TM: 유지
- **nextBlockMode = LIGHT** (SQ가 트리거)
- 다음 블록은 LIGHT_BLOCK_CYCLE_COEFFICIENTS 사용

```
Light 모드 Cycle 1, Session A, SQ:
  무게 = newSQ_TM × 0.85 × 0.875  (일반: 0.925)
```

> 테스트: 한 리프트만 light 트리거해도 블록 전체가 light. 모든 리프트에 적용.

### 시나리오 3: BW 변동

**시작**: WPU TM = 100kg, BW = 73kg, 추중량 = 27kg

**다이어트 후 BW 68kg (−5kg)**:
```
newWPU_TM = 100 + (68 − 73) = 95kg
```

**같은 사이클에서 Session A WPU**:
- 이전: 100 × 0.925 × 0.85 = 78.63 → 77.5 / 추중량 = +4.5 → +2.5kg
- 이후: 95 × 0.925 × 0.85 = 74.69 → 72.5 / 추중량 = +4.5 → +2.5kg

> 테스트: BW 입력 시 WPU TM 자동 재계산. 다른 TM은 영향 없음.

### 시나리오 4: 클라이밍 후 세션 스왑

**상태**: 다음 예정 Session = B (seqIdx=1)
**조건**: 24시간 이내 클라이밍 수행
**조치**: Session C로 임시 스왑 → Session B는 그 다음 운동일에

**상태 변화**:
- seqIdx 1 (예정 B) 스킵 가능
- 대신 seqIdx 2 (C) 먼저 수행
- 다음 운동일: seqIdx 1 (B)로 복귀

> 테스트: 스왑 후에도 사이클 전체 카운팅 정확해야 함. 결국 12 세션 모두 수행되어야 블록 완료.

---

## 6. 엣지 케이스 체크리스트

### 입력 검증
- [ ] 초기 TM 음수 입력 거부
- [ ] BW 음수 입력 거부
- [ ] AMRAP 렙 수 0 허용 (블록 종료 가능)
- [ ] AMRAP 렙 수 음수 거부
- [ ] DL TM > SQ TM 입력 시 자동 캡 (DL = SQ)
- [ ] OHP TM > BP × 0.5 입력 시 자동 캡

### 계산 경계
- [ ] 작업 무게가 라운딩 후 0 또는 음수가 되는 경우 (TM 너무 낮음)
- [ ] WPU 추중량이 0인 경우 (정확히 BW만큼)
- [ ] WPU 추중량 음수 (밴드 보조 안내)
- [ ] OHP TM이 빈 바(20kg) 미만인 경우 안내

### 상태 전환
- [ ] seqIdx 11 → 12로 가지 않고 새 블록 0으로
- [ ] 블록 중도 중단 → 재개 시 seqIdx 유지
- [ ] 11일 이상 휴식 → 한 사이클 전부터 재개 (seqIdx 3 감소)
- [ ] 3주 이상 휴식 → 블록 폐기, 새 블록 시작 (TM × 0.95)

### TM 업데이트
- [ ] AMRAP 결과 부분 누락 시 (예: SQ만 기록, BP 안 함) → 미기록 리프트는 유지
- [ ] AMRAP ≤ 2렙 한 리프트만 있어도 nextBlockMode = light
- [ ] light 모드 한 블록 후 자동으로 normal 복귀

### 멀티 세션 동시성
- [ ] 같은 세션 두 번 기록 시도 방지
- [ ] seqIdx 건너뛰기 방지 (1 다음 3으로 갈 수 없음, 스왑은 임시)

### 데이터 정합성
- [ ] 블록 시작 시 initialTMs 저장 (블록 중 TM 변경되어도 작업 무게는 initialTMs 기반)
- [ ] 세션 완료 시점에 actualWeight 기록 (사용자가 무게 변경했을 수도)
- [ ] BW 변경 시점 기록 (세션별 BW 추적)

---

## 7. 로직 검증 매트릭스 (요약)

| 함수 | 입력 | 출력 검증 포인트 |
|---|---|---|
| `calculateWorkingWeight` | TM, cycle, session, lift | floor(2.5kg), 음수 방지 |
| `calculatePullupAddedWeight` | wpuTM, BW, cycle, session | 음수 허용, 라운딩 정확 |
| `deriveAuxTMs` | sqTM, bpTM | DL=SQ, OHP=floor(BP×0.5/2.5)×2.5 |
| `shouldAMRAP` | cycle, session, lift, set, total | Cycle 3 AND last set AND 매핑 일치 |
| `determineNextTM` | currentTM, reps | 4단계 분기, light 트리거 |
| `getNextSession` | block | (cycle, sessionType, seqIdx) |
| `completeBlock` | block, amrapResults | 5개 TM 업데이트 + 모드 |

---

## 8. 빠른 디버깅 공식

**현재 어디 있는지**:
```
cycle = floor(seqIdx / 3) + 1
session = ['A','B','C'][seqIdx % 3]
isAmrapCycle = (cycle === 3)
isLastSeqOfBlock = (seqIdx === 11)
```

**기대 작업 무게 (메모리에서 빠르게)**:
```
TM=100 SQ:
  C1A=80, C2A=82.5, C3A=85, C4A=72.5
  C1B=62.5, C2B=65, C3B=67.5, C4B=57.5
  C1C=67.5, C2C=70, C3C=72.5, C4C=62.5
```

**AMRAP 위치 (테스트할 때 빠르게 찾기)**:
```
seqIdx=6 (C3 SessionA): SQ 4세트, WPU 4세트
seqIdx=8 (C3 SessionC): BP 4세트
나머지 9개 세션: AMRAP 없음
```

---

**Asymptote Protocol Test Guide** — 모든 분기 검증 후 프로덕션.
