# 전체 프로그램 화면 모의 실테스트 결과 (2026-07-17)

## 결론

- dev DB·프로그램 스토어의 공개 프로그램 12개를 모바일 화면(Chromium 390×844)으로 전수 확인했다.
- 첫 세션 정상 경로 12개, 일반 프로그램 심층 프로토콜 13개(총 88세션), REF5 전용 프로토콜 11개가 모두 통과했다.
- 사용자가 결과·원인·다음 행동·선택 효과를 이해할 수 있는지도 화면 문구와 저장 상태를 대조했다.
- 테스트 중 실제 결함은 수정했다. 가입 5회/IP 제한과 Next.js dev Fast Refresh는 제품 결함과 분리했다.

## 검증 범위

| 묶음 | 범위 | 결과 |
|---|---|---|
| 스토어 목록 정합성 | 공개 카드 12개와 테스트 매트릭스 집합 비교 | 통과 |
| 전 프로그램 기본 여정 | 가입 → 프로그램 선택 → 시작 설정 → 전 세트 입력 → 저장 → DB 재조회 → 재진입 | 12/12 통과 |
| 일반 프로그램 심층 여정 | 11개 일반 프로그램·변형, 13개 상황, 저장 세션 88회 | 13/13 통과 |
| REF5 심층 여정 | 시간창·밀도·PASS/HOLD/FAIL/INVALID·강제 마이크로·정체·재개 등 | 11/11 통과 |
| 브라우저 감시 | `pageerror`, console error, HTTP 5xx | 최종 시나리오 0건 |

환경은 Next.js `127.0.0.1:3100`, Hono API `127.0.0.1:8787`, Supabase PostgreSQL `dev` 스키마다. 각 시나리오는 별도 계정·플랜으로 격리했고, 쓰기는 화면 조작으로 수행했다. API는 저장 결과와 진행 상태를 읽어 화면 설명과 실제 상태가 같은지 대조하는 데만 사용했다.

## 프로그램별 상황·이해 가능성

| 프로그램 | 노출한 핵심 상황 | 사용자 피드백·선택 확인 | 결과 |
|---|---|---|---|
| Manual Sessions | A/B 교대, 자동 진행 없음 | 시작 화면에서 고정 세션·수동 기록임을 설명 | 통과 |
| Starting Strength | 성공 증량, 실패 1/3·2/3·3/3 | 원인, 누적 횟수, 같은 무게 재도전, 3회차 감소 선택, 다음 적용 무게 | 통과 |
| StrongLifts | 3회 연속 실패 후 권장 감소 | 사용자가 `유지`로 변경했을 때 실제 상태·다음 안내도 유지 | 통과 |
| Greyskull LP | AMRAP 7회 단일 증량, 10회 2단계 증량, 실패 1/2·2/2 | AMRAP 명시, 기준 숫자, 리셋 선택, 취소 후 재진입 | 통과 |
| Texas Method | 볼륨/회복/강도일, 강도일 실패 1/3·2/3·3/3 | 역할 라벨, 다음 강도일 재도전, 주간 기준 리셋과 파생 무게 재계산 | 통과 |
| GZCLP | T1 `5×3→6×2→10×1→85%`, T3 AMRAP 양쪽 분기 | 스킴 강등·유지·리셋, AMRAP 25회 기준과 다음 행동 | 통과 |
| Tactical Barbell Operator | 18세션·6주 파동, 마지막 처방 미달 | 전체 증량 보류 이유, 전 리프트 기본 HOLD, 취소/재개, 다음 블록 동일 TM | 통과 |
| 5/3/1 기본 | 16세션·4주 파동, 블록 종료 | 리프트별 기본 증량, OHP만 HOLD 변경, 실제 다음 사이클 반영 | 통과 |
| 5/3/1 FSL | 메인 3세트 + 보조 5×5 | 보조 세트가 메인 진행 판정에 섞이지 않음 | 통과 |
| 5/3/1 BBB | 메인 3세트 + 보조 5×10 | 보조 세트가 메인 진행 판정에 섞이지 않음 | 통과 |
| Asymptote | 12세션 블록, AMRAP 증량/HOLD/-5+라이트, 전날 예고, 연속일 보류, 조기 디로드 | 판정 기준, 보류 이유, 쉬고 재시도하는 방법, 회복 점프와 TM 유지 | 통과 |
| REF5 | 고유 시간창·밀도·종료 사유·스트림별 결과·강제 마이크로 | 현재 가능 상태, 선택 의미, PASS/HOLD/FAIL/INVALID 및 다음 프로토콜 노출 | 11/11 통과 |

## 확인·수정한 결함

### 공통 경로

- 프로그램의 명시적 `0회`를 미입력으로 보던 문제를 수정했다. 이제 1회 처방 실패도 저장되며, 재열기·재편집 시 `0`과 실패 표시가 유지된다.
- 사용자 선택이 권장 기본값과 같을 때 reducer의 전문 원인(동결·AMRAP 등)을 덮어쓰던 문제를 수정했다. 실제로 값을 바꾼 선택만 override로 기록한다.
- 저장 후 피드백이 결과만 말하던 구간에 원인·누적 임계값·다음 행동·적용 시점을 추가했다.
- 앱 로케일이 API 프록시의 브라우저 헤더에 밀리던 문제와, 중단된 UX telemetry body가 500을 만들던 문제를 수정했다.
- AMRAP 처방은 `3+` 같은 암시적 표기 외에 명시적인 `AMRAP` 칩을 노출한다.

### 프로그램별 경로

- SS/StrongLifts: 실제 처방 reps를 진행 판정에 전달하고 A/B 세션 회전을 복구했다.
- Greyskull: AMRAP 단일/2단계 증량과 2회 실패 기준을 전용 문구로 설명하고 세션 회전을 복구했다.
- Texas: V/R 세트를 진행 판정에서 제외하고 I 슬롯만 추적하며 V/R/I 회전을 복구했다.
- GZCLP: 4일 회전과 T1/T2 단계·T3 AMRAP 판정을 화면 상태와 맞췄다.
- Operator/5/3/1: 미해소 실패가 있으면 블록 전체 HOLD를 기본 추천하고, 동적 상태 키를 실제 리프트 선택에 연결했다.
- 5/3/1 FSL/BBB: ASSIST 5세트를 진행 판정에서 제외했다.

## 결함이 아닌 관찰

- 가입은 IP당 시간당 5회로 제한된다. 독립 계정 13개를 만드는 테스트는 공식 CI 옵션 `WORKOUT_DISABLE_RATE_LIMIT=1`이 필요하다. 제한 자체와 사용자 오류 안내는 정상이다.
- dev 서버를 병렬로 압박하면 저장 직후 Fast Refresh가 전체 reload를 일으킬 수 있었다. 네트워크 trace에서 저장·요약 RSC 200을 확인했고, 직렬 실행에서는 프로토콜이 통과했다. production 빌드 결함으로 판정하지 않았다.
- REF5 첫 세션은 v1.2 계약상 4종목·9세트다. 초기 테스트의 3종목 가정은 테스트 기대값 오류였다.

## 자동화와 재현

- 기본 전수: [`all-programs-user-journey.spec.ts`](../e2e/all-programs-user-journey.spec.ts)
- 일반 심층: [`all-programs-protocol-journey.spec.ts`](../e2e/all-programs-protocol-journey.spec.ts)
- REF5 심층: [`ref5-user-journey.spec.ts`](../e2e/ref5-user-journey.spec.ts)

```powershell
$env:WORKOUT_DISABLE_RATE_LIMIT='1'
pnpm -C web exec playwright test e2e/all-programs-user-journey.spec.ts --project chromium --workers=1
pnpm -C web exec playwright test e2e/all-programs-protocol-journey.spec.ts --project chromium --workers=1
pnpm -C web exec playwright test e2e/ref5-user-journey.spec.ts --project chromium --workers=1
```

마지막 심층 재검증은 가입 제한 원인 확인 전 8개가 통과했고, 테스트 전용 해제 후 남은 5개가 통과해 13/13으로 확정했다.

## 회귀 검사

| 검사 | 결과 |
|---|---|
| `packages/core` 전체 단위 테스트 | 374/374 통과 |
| `web` 전체 단위 테스트 | 134/134 통과 |
| `web`·`apps/api` typecheck | 통과 |
| `web` lint·design lint | 통과 |
| core 경계 금지 import 검사 | 통과 |
| `git diff --check` | 통과 |

## 한계

- 실제 iOS/Android 기기, Safari, PWA 오프라인·서비스워커 전환은 포함하지 않았다.
- 테스트는 dev DB에 격리 계정과 로그를 생성한다.
- 현재 변경은 로컬 작업트리에 있으며 커밋·배포하지 않았다.
- [`program-seed-guide.md`](program-seed-guide.md)는 과거 6개 프로그램 기준이라 현재 공개 12개 목록으로 별도 갱신이 필요하다.
