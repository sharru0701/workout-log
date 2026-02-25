# PR16 Release Readiness

Date: 2026-02-25  
Release Type: UI/UX Quality Gate + Verification Layer

## 1) 변경된 UX 흐름 요약 (Release Notes)

1. 루트 진입
- 기존: 기능 카드/혼합 패턴 중심 이동
- 현재: `Root -> Category Section -> Settings Row` 기반 이동

2. 검색 진입
- 기존: 검색 결과가 화면 경로로 직접 이동
- 현재: `검색 결과 -> /settings/link/{key} -> Resolver -> 대상 화면/Row` 규칙 통일

3. 상세 설정 입력
- 기존: 일부 입력이 한 화면 내 집중
- 현재: `ValueRow 탭 -> 하위 선택/입력 화면 -> Back 즉시 반영`

4. 저장 체감
- 기존: 저장 동작/실패 처리 일관성 부족
- 현재: `Optimistic update -> 실패 시 인라인 안내 + 롤백 -> 해당 Row만 잠금`

5. 오류 링크 처리
- 기존: 잘못된 링크에서 일반 에러 경험 가능
- 현재: 404 대신 iOS 톤의 인라인 안내 + 복구 Row 제공

## 2) 릴리즈 게이트

필수 통과 명령:

- `pnpm --dir web run build`
- `pnpm --dir web run test:settings:compliance`

구성:
- Contrast gate: `test:a11y:contrast`
- 구조/간격/타이포/터치/상태: `ios-settings-compliance.spec.ts`
- 접근성 자동 점검: `ios-settings-a11y.spec.ts`
- 시각 캡처: `ios-settings-visual.spec.ts` (기본)
- 시각 회귀(엄격): `IOS_SETTINGS_VISUAL_STRICT=1` 모드에서 스냅샷 비교

## 3) QA 전달 포인트

- 체크리스트 문서: `docs/pr16-ios-settings-compliance-checklist.md`
- 딥링크 표준: `docs/pr15-settings-deeplink-standard.md`
- 검색 표준: `docs/pr14-settings-search.md`
- 접근성 기준: `docs/pr8-accessibility-report.md`

## 4) 릴리즈 리스크 / 대응

- 스냅샷 변경 발생 시:
  - 의도된 UI 변경이면 `test:settings:compliance:visual:update`로 기준선 갱신
  - 비의도 변경이면 회귀로 간주하고 원인 수정

- 접근성 위반 발생 시:
  - axe 결과 노드 기반으로 즉시 수정
  - 색상 대비는 토큰 스크립트와 함께 재확인

## 5) 최종 승인 체크

- [ ] 빌드 성공
- [ ] iOS Settings compliance gate 통과
- [ ] 변경된 UX 흐름 릴리즈 노트 반영
- [ ] QA 수동 탐색(검색/딥링크/저장롤백) 완료
