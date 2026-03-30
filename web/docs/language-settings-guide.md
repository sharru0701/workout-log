# 언어 설정 가이드

## 목적

앱의 사용자 노출 카피를 `한국어` 또는 `English`로 일관되게 표시하기 위한 설정 가이드입니다.

이 문서는 다음을 설명합니다.
- 사용자가 앱에서 언어를 바꾸는 방법
- 설정 변경 후 어떤 화면에 반영되는지
- 개발자가 locale 동작을 확인하거나 확장할 때 참고할 기준

## 사용자 가이드

### 언어 변경 경로

앱에서 아래 경로로 이동합니다.

```text
설정 > Language
```

언어 옵션:
- `한국어`
- `English`

### 동작 방식

- 언어를 바꾸면 주요 화면, 시트, 모달, 상태 메시지가 즉시 반영됩니다.
- 변경값은 사용자 설정에 저장되며, 다음 앱 실행 시에도 유지됩니다.
- 서버 응답 기반 기본 문구와 일부 fallback 메시지도 현재 locale을 따릅니다.

### 반영 대상 예시

- 홈
- 운동 기록
- 캘린더
- 프로그램 스토어
- 플랜 / 템플릿
- 통계
- 설정 화면
- 공용 모달 / 시트 / 검색 / 빈 상태 / 오류 상태

## 개발 가이드

### 설정 저장 키

언어 설정은 사용자 preference에 아래 키로 저장됩니다.

```text
prefs.locale
```

지원 값:

```text
ko
en
```

### locale 해석 기준

현재 구현은 아래 순서의 흐름을 따릅니다.

1. 서버 렌더 시 요청 기반 locale 해석
2. 클라이언트 locale provider에서 현재 locale 제공
3. 사용자 설정 저장값을 localStorage / settings API / cookie와 동기화

핵심 파일:
- `src/components/locale-provider.tsx`
- `src/lib/i18n/messages.ts`
- `src/lib/settings/workout-preferences.ts`
- `src/app/settings/language/page.tsx`

### 새 문자열 추가 원칙

- 사용자에게 보이는 고정 카피는 하드코딩하지 않습니다.
- 가능한 한 `messages.ts`에 locale별 copy를 추가한 뒤 사용합니다.
- 공용 컴포넌트는 prop이 비어도 locale-aware fallback을 가지도록 유지합니다.
- 서버 route의 기본 에러/empty/fallback 응답도 요청 locale을 기준으로 내려줍니다.

### QA 체크리스트

- `설정 > Language`에서 `한국어`, `English` 전환이 모두 동작하는지 확인
- 새로고침 후 선택 언어가 유지되는지 확인
- 홈, 운동 기록, 프로그램 스토어, 통계, 설정에서 한영 혼합이 없는지 확인
- 빈 상태 / 에러 상태 / 오프라인 / PWA 배너도 locale 전환을 따르는지 확인
- 서버 fallback 문구가 영어 설정에서 한국어로 새지 않는지 확인

## 문서 갱신 기준

아래 중 하나가 바뀌면 이 문서도 같이 갱신합니다.
- 지원 언어 종류
- locale 저장 키 또는 저장 방식
- 설정 진입 경로
- 공용 i18n 구조
- 서버 fallback locale 처리 방식
