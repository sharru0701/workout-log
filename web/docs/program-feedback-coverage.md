# 프로그램 진행 피드백 커버리지

진행 판정의 단일 데이터원은 `plan_progress_event`의 `reason`과 `meta.targetDecisions`다. 서버의 [`feedback-catalog.ts`](../../packages/core/src/progression/feedback-catalog.ts)가 로케일 문구를 조립하고 web·TUI가 같은 payload를 렌더링한다.

피드백은 다음 네 질문에 답해야 한다.

1. 결과가 무엇인가
2. 왜 그런가
3. 다음 세션에서 무엇을 해야 하는가
4. 선택을 바꾸면 어떤 값이 언제 적용되는가

## 패밀리별 표출

| 패밀리 | 주요 이벤트 | 화면에 보이는 판단 근거·행동 |
|---|---|---|
| Manual | 자동 진행 없음 | 고정 세션이며 사용자가 작성한 그대로 기록됨 |
| Starting Strength / StrongLifts | 증량, 실패 streak, 리셋 | 처방 완료, 실패 `1/3·2/3·3/3`, 같은 무게 재도전, 새 무게 적용 |
| Greyskull | AMRAP 단일/2단계 증량, 실패, 리셋 | `5–9`, `10+`, 실패 `1/2·2/2`, 다음 AMRAP 목표 |
| Texas Method | 주간 증량, 강도일 실패, 주간 리셋 | V/R/I 역할, 실패 `1/3·2/3·3/3`, 다음 강도일, 파생 무게 재계산 |
| GZCLP | stage clear/down/reset, T3 AMRAP | 현재 단계 변화, 무게 유지/증량/85% 리셋, AMRAP 25회 기준 |
| Operator | 블록 중간 미달, 블록 증량/동결 | 미해소 실패, 전체 증량 보류, 다음 블록 동일 TM |
| 5/3/1 | 4주 블록 증량/동결 | 다음 사이클 TM, 리프트별 증량·유지 선택, ASSIST 판정 제외 |
| Asymptote | AMRAP 판정, 파생 TM, 보류, 조기 디로드 | AMRAP reps, `+2.5/HOLD/-5+light`, 휴식 부족, 회복 점프와 TM 유지 |
| REF5 | PASS/HOLD/FAIL/INVALID, 창·밀도·마이크로 | 현재 가능 상태와 종료 사유의 의미, 다음 스트림·강제 세션·재평가 |

## 선택 처리

- SS/StrongLifts/Texas는 3번째 연속 실패, Greyskull은 2번째 실패에서 운동별 선택창을 연다.
- Operator·5/3/1은 블록 종료 시 운동별 `증량/유지/감소`를 제공한다.
- 블록에 미해소 실패가 하나라도 있으면 전체 `유지`가 기본 권장값이다.
- 사용자가 권장값을 그대로 확정하면 reducer의 전문 reason을 보존한다.
- 실제 값을 변경한 선택만 `override:per-target:*`로 기록하고 다음 노출에 반영한다.
- 취소하면 저장하지 않고 같은 완료 동작에서 선택창을 다시 열 수 있다.

## 노이즈 정책

- 의미 있는 HOLD는 표출한다: LP 실패 누적, Texas 강도일 실패, GZCLP stage-down/T3 미달, Operator·5/3/1 블록 실패, Asymptote AMRAP HOLD.
- 단순 블록 중간 성공 streak처럼 사용자의 행동을 바꾸지 않는 HOLD는 카드에서 생략한다.
- 미등록 reason은 INCREASE/RESET 기본 문구로 폴백하되, HOLD는 무조건 노출하지 않는다.

## 검증

- 단위: `packages/core/src/progression/feedback-catalog.test.ts`, `web/src/features/workout-log/model/progression-choice.test.ts`
- 화면 심층: `web/e2e/all-programs-protocol-journey.spec.ts`, `web/e2e/ref5-user-journey.spec.ts`
- 2026-07-17 결과: 일반 심층 13/13, REF5 심층 11/11 통과. 상세는 [`all-programs-screen-simulation-test-report-2026-07-17.md`](all-programs-screen-simulation-test-report-2026-07-17.md).
