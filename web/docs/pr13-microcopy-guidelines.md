# PR13 Microcopy & Footnote Rules

Date: 2026-02-25  
Goal: 통합된 iOS Settings 톤으로 마이크로카피를 정리하고, 섹션 설명을 하단 footnote로 일원화한다.

## 1) 문장 톤 규칙

- 한 문장에 한 행동만 담는다.
- 명령형/안내형을 짧게 쓴다.
- 주어 생략, 동사 중심으로 끝낸다.
- 상태 문구는 현재형으로 쓴다.

예시
- `필터를 선택해 수정하세요.`
- `하위 화면에서 돌아오면 즉시 반영됩니다.`

## 2) 길이 규칙

- Row `label`: 2~12자 권장.
- Row `description`: 1문장, 28자 내외 권장.
- `SectionFootnote`: 1문장 권장, 최대 2문장.
- 화면 상단 caption: 맥락 1문장만 허용, 절차 설명 금지.

## 3) 금지 표현

- 장문 절차 나열(예: `1) ... 2) ... 3) ...`)을 상단 안내로 배치하지 않는다.
- 강한 경고 박스/과장 어조(`반드시`, `치명적`, `즉시 조치`)를 남발하지 않는다.
- 모호한 표현(`적절히`, `필요시 알아서`)을 쓰지 않는다.
- 영문/약어 혼합 문장을 기본 문구로 사용하지 않는다.

## 4) 배치 규칙

- 섹션 설명은 `SectionHeader`가 아닌 `SectionFootnote`로 섹션 하단에 둔다.
- 경고/주의는 박스 대신:
  1. 섹션 하단 footnote
  2. 재시도/상세 이동 Row
  조합으로 처리한다.
- 선택/입력 화면도 동일하게: `옵션 목록` 아래 footnote, `적용` 섹션 아래 footnote.

## 5) 적용 결과 (PR13)

아래 화면군에 동일 규칙 적용:
- 루트/카테고리: `/`, `/plans`, `/calendar`, `/stats`, `/templates`, `/settings`, `/offline`, `/workout/today`
- 선택/입력 템플릿: `selection-screen-template` + 선택/피커 라우트 전반
- 상태/정책 샘플: `/settings/state-samples`, `/settings/save-policy`, `/settings/selection-template`
- 워크스페이스 주요 화면: `plans/manage`, `templates/manage`, `stats/dashboard`, `calendar/manage`, `workout/today/log`, `workout/session/[logId]`

## 6) 변환 패턴

- Before: `SectionHeader description` 기반 설명
- After: `SectionHeader(title)` + `SectionFootnote(...)`

- Before: `Generate & apply` / `Open day` 등 혼합 영문
- After: `생성 및 적용` / `날짜 열기` 등 단일 톤 한국어

- Before: 오류를 상단 경고 텍스트로 강조
- After: 인라인 오류 + `재시도` Row + footnote 안내
