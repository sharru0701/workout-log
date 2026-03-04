# Program Seed Canonical Research (2026-03-04)

## 목적
- 기존 앱 구조를 유지한 채 프로그램 seed를 실전 검증 가능한 수준으로 세팅하기 위한 기준 정리
- 변형이 많은 프로그램은 **base/common variant**만 채택

## 최종 채택 프로그램
1. Starting Strength LP
2. StrongLifts 5x5
3. Texas Method
4. GZCLP (base T1/T2/T3)
5. Greyskull LP (base A/B)

## 선정 이유 요약
- 초급 선형 증량형: Starting Strength, StrongLifts 5x5
- 주간 강도 변화형: Texas Method
- tier/top set 성격 확인용: GZCLP
- AMRAP 성격 확인용: Greyskull LP, GZCLP

## 프로그램별 출처 및 채택 규칙
| 프로그램 | 채택한 canonical/base 규칙 | 출처 1 | 출처 2 |
|---|---|---|---|
| Starting Strength LP | A/B 로테이션, Squat 3x5 중심, Press/Bench 교차, Deadlift 1x5, Power Clean 포함 base | https://startingstrength.com/get-started/programs | https://www.outlift.com/starting-strength-program/ |
| StrongLifts 5x5 | A/B 로테이션, 주운동 5x5, B day Deadlift 1x5 | https://stronglifts.com/stronglifts-5x5/ | https://www.muscleandfitness.com/workout-routines/strength-training-workouts/get-stronglift-5x5-training-program/ |
| Texas Method | Volume / Recovery / Intensity 3일 구조, Intensity day top set 중심 | https://startingstrength.com/article/the_texas_method | https://www.setforset.com/blogs/news/the-texas-method-workout |
| GZCLP | T1/T2/T3 tier 구조, T1 저반복/고강도, T3 고반복 + AMRAP 성격 | https://www.boostcamp.app/cody-lefever/gzcl-program-gzclp | https://www.liftosaur.com/blog/the-gzclp-method-simplified/ |
| Greyskull LP | A/B 구조, 메인 리프트 2x5 후 마지막 세트 5+ AMRAP, Deadlift 단일 고반복 세트(base 관행) | https://www.boostcamp.app/johnny-pain/greyskull-lp | https://liftvault.com/programs/strength/greyskull-linear-progression-spreadsheet/ |

## 이번 seed에서 제외한 항목
- 코치/개인별 세부 증량 규칙(실패 시 리셋 규칙의 세부 분기)
- 보조운동 대규모 템플릿
- 책/유료 자료에만 있는 상세 변형
- `%TM` 기반 5/3/1 계열(이번 정리 범위에서 legacy 531/operator/candito-linear 제거)
- 프로그램 엔진 신규 kind 추가

## 구현 반영 원칙
- 엔진 재작성 없이 기존 `LOGIC + MANUAL` 체계 사용
- rule 다양성은 manual session의 `note/percent`로 표현
- AMRAP/top set/back-off 성격은 `set.note` 기반으로 UI에서 표시
