# Hybrid v0.5.1 — Failure-Protocol Feedback Patch (Claude Code 구현 스펙)

> 문제: 엔진은 실패 프로토콜(AMRAP 판정·보류·조기 디로드·라이트 블록)을 정확히 처리하지만,
> 사용자에게 **무슨 일이 왜 일어났는지** 알리는 출구가 거의 없다.
> 원칙: **판정이 일어나는 3개 순간에 출구를 만든다 — ①세션 시작 전(예고) ②세트 수행 시(현장) ③블록 전환 시(리포트).**
> 엔진 로직(판정·매트릭스·가드)은 **일절 변경 금지** — 이 패치는 기록 1건 추가 + 표출이 전부다.

| 항목 | 내용 |
|---|---|
| Version | 0.5.1 (spec) |
| 베이스 | Hybrid v0.5 (커밋 1a766b2) — 판정 로직 무변경 |
| 변경 | F1 조기디로드 이벤트화 · F2 블록 판정 리포트 · F3 AMRAP 보류 배너 · F4 라이트 블록 배지 · F5 AMRAP 전날 예고 |

---

## 현황 진단 (2026-07 코드 실측)

| 레이어 | 엔진 | 현재 피드백 | 갭 |
|---|---|---|---|
| AMRAP 보류 | `asymptoteShouldDeferAmrap` → 세트 자동 전환 | 세트 note 문자열 `"AMRAP 보류(연속일) · 그라인딩 정지"` (generateSession.ts L662~) | 세트 단위 텍스트뿐 — 세션 수준 고지 없음 |
| AMRAP 판정 | reducer가 INCREASE/HOLD/RESET + `amrapReason`을 `plan_progress_event`에 기록 | **없음** — API에 `buildProgressionSummary`/`includeProgression`은 존재하나 웹 표출 미확인 | 판정 결과가 화면에 안 나옴 |
| 조기 디로드 점프 | reducer L1005~: `state.week = 4; state.day = 1;` | **없음 — 이벤트 기록조차 안 함** | 완전 침묵 |
| 라이트 블록 | `state.lightBlockMode = true` + 판정 reason | **없음** | 무게 급감·탑세트 실종을 사용자가 추리 |

---

## F1. 조기 디로드 점프 — 이벤트 기록 + 표출 (최우선)

### 엔진 (기록만 추가, 판정 로직 무변경)
- 위치: `packages/core/src/progression/reducer.ts` 조기 디로드 분기 (`regressed >= 2` 블록, L1005~).
- week=4 점프 시 이벤트 1건 push: 기존 `ProgressionEventType`의 `"ADVANCE_WEEK"` 재사용,
  `reason: "deload:trigger:regressed=<드라이버명 콤마목록>"` (예: `deload:trigger:regressed=SQUAT,PULL`).
- 기존 이벤트 파이프라인(`plan_progress_event` 저장 경로) 그대로 태움 — 새 저장 경로 금지.

### UI
- 다음 세션 화면 상단 배너: **"⚠️ 조기 디로드 발동"** + 한 줄 설명 "메인 리프트 2개에서 렙 급감이 누적돼 회복 사이클로 점프했어요. TM은 유지됩니다."
- 배너 패턴: 기존 `BodyweightCheckBanner`(체중 배너) 컴포넌트 패턴 재사용.
- 노출 조건: 최신 이벤트가 위 reason이고 아직 해당 디로드 사이클(week 4) 진행 중.

### 테스트
- reducer: 점프 시 이벤트 1건 생성(사유·드라이버 목록 포함), 점프 없으면 미생성. 기존 `asymptote-trigger-deload.test.ts` 확장.
- UI: 이벤트 존재 시 배너 렌더, week 4 종료 후 미렌더.

---

## F2. 블록 판정 리포트 (AMRAP → TM 변경 요약)

### 데이터 — 이미 존재, 추가 기록 불필요
- `plan_progress_event`에 리프트별 eventType(INCREASE/HOLD/RESET) + `amrapReason` 저장됨.
- API `includeProgression` / `buildProgressionSummary` (`progression/progress-events.ts`) 활용.
- ⚠️ 구현 전 확인: `web/src/features/workout-log/model/context-loader.ts`가 progressionSummary를 이미 어딘가 그리는지 — 그린다면 F2는 신규가 아니라 **확장**으로 처리.

### UI — "블록 판정 카드"
- 트리거: 블록 마지막 세션(week 4 · day 3) 로그 저장 직후 + 이후 플랜 화면 재방문 시 1회성 카드.
- 내용 (리프트별 1행): `SQ — AMRAP 9렙 → TM 90 → 92.5 (+2.5)` 형식. HOLD면 "유지 · 같은 무게 재도전", RESET −2.5면 "재조준", −5면 "−5 + 다음 블록 라이트".
- AMRAP 미기록(보류) 리프트: `판정 연기 — TM 유지` 로 명시 (침묵 금지).
- 말투는 치트시트 상황판단표와 동일 톤 유지 (재조준/전진/회복 블록).

### 테스트
- 판정 조합별(+2.5/유지/−2.5/−5+라이트/연기) 카드 문구 스냅샷.

---

## F3. AMRAP 보류 — 세션 수준 배너로 승격

- 현행 유지: 세트 note의 `"AMRAP 보류(연속일)"` (변경 금지).
- 추가: 그날 세션에 보류된 AMRAP이 1개 이상이면 세션 화면 상단 배너:
  **"⏸️ 오늘 AMRAP 보류(연속일 휴식 부족)"** + "판정은 다음 블록으로 — TM 유지. 평소 세트만 치면 됩니다."
- 판정 근거: 생성된 세션의 planned set 중 `amrapEligible && deferAmrap`인 세트 존재 여부 — 생성부(generateSession.ts L660)의 판정값을 세션 메타로 1개 올려주면 UI가 세트를 뒤질 필요 없음 (`session.meta.amrapDeferred: true` 권장).

### 테스트
- restDayGap < 2 세션 생성 시 meta 플래그 true + 배너 렌더 / gap ≥ 2 시 false.

---

## F4. 라이트 블록 배지

- 조건: `plan_runtime_state.state.lightBlockMode === true`.
- 플랜 화면 + 세션 화면에 지속 배지: **"🌙 라이트 블록 (회복)"** + 툴팁/한줄: "직전 AMRAP 0~2렙 → TM −5 + 이번 블록은 감량 계수로 진행, 탑세트 미발동."
- 블록 종료(플래그 해제) 시 자동 소멸.

### 테스트
- 플래그 true/false에 따른 배지 렌더링.

---

## F5. AMRAP 전날 예고 (선택 — 가치 높음)

- 조건: 다음 예정 세션이 AMRAP 세션(사이클3의 A 또는 C)이고, **오늘 운동을 저장하면** 내일 restDayGap < 2가 되는 상황.
- 표출: 오늘 세션 저장 화면에 정보성 한 줄: **"🎯 다음 세션은 AMRAP(판정)입니다 — 내일 치면 보류됩니다. 하루 쉬고 치면 판정 가능."**
- 강제 아님, 차단 아님 — 정보만. (사용자 규칙 "쉼→#7→#8→쉼→#9"의 앱측 보조)
- 판정에 필요한 값(cycleInBlock, 다음 세션 번호, AMRAP 여부)은 전부 기존 상태·블루프린트에서 파생 가능.

### 테스트
- 사이클3 직전 세션 저장 시 노출 / 그 외 미노출.

---

## 스코프 아웃 (금지)

- 판정 매트릭스·가드·점프 조건 등 **엔진 판정 로직 변경 금지** (F1의 이벤트 push는 기록이지 판정 아님).
- 푸시 알림/이메일 등 외부 채널 — 이번 범위 아님 (인앱 표출만).
- 무릎 관련 표출 — 스코프 아웃 유지 (v0.5 스펙 §D).

## 구현 순서 권장
F1 → F3 → F2 → F4 → F5 (기록 갭부터 막고, 현장 → 리포트 → 상태 → 예고 순)

## 부록: 버전 히스토리 (asymptote-async-hybrid.md에 추가)
| Version | Date | Changes |
|---|---|---|
| 0.5.1 | 2026-07-08 | 실패 프로토콜 피드백: 조기디로드 이벤트화+배너, 블록 판정 리포트, AMRAP 보류 배너, 라이트 블록 배지, AMRAP 전날 예고. 엔진 판정 로직 무변경. |
