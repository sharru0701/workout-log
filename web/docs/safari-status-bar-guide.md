# Safari Status Bar / Safe Area Notes

이 문서는 iOS Safari에서 상단 상태바 투명 효과가 깨질 때 확인해야 할 사항을 정리한 메모다.

## 증상

- 상태바 뒤로 컨텐츠가 흘러가야 하는데, 상단 safe-area에 배경색이 생김
- 새로고침 직후 잠깐 정상이다가, 이후 흰색 또는 테마색 tint가 덮임
- 바텀시트/모달/스플래시를 건드린 뒤 재발하기 쉬움

## 우선 의심할 것

1. `position: fixed` 전체 화면 레이어
- 특히 `inset: 0`으로 상태바 영역까지 덮는 overlay, splash, modal blocker
- Safari가 이 레이어를 top bar tint 소스로 다시 잡을 수 있음

2. 루트 배경색과 테마 적용 타이밍
- `html`, `body` 배경색
- 서버 첫 렌더 테마와 클라이언트에서 다시 적용되는 테마가 다르면 Safari가 상단 tint를 다시 샘플링할 수 있음
- 현재는 [`app/layout.tsx`](../src/app/layout.tsx)에서 early theme bootstrap 스크립트로 첫 페인트 전에 테마를 맞춤

3. 전역 스크롤 락
- `html/body/app-shell`에 `overflow: hidden`, `position: fixed`, `touch-action: none` 등을 걸면 상단 상태바 tint가 다시 생길 수 있음
- 가능하면 전역 루트 락보다 로컬 컴포넌트 수준 제어를 우선

## 피해야 할 패턴

- `fixed` fullscreen backdrop를 safe-area top까지 덮는 것
- `body.style.position = "fixed"` 같은 body lock
- 모달을 닫은 뒤에도 남는 전역 dataset/class/style
- splash / launch overlay가 상태바 영역까지 덮는 것

## 현재 유지 중인 대응

1. 초기 테마 부트스트랩
- [`app/layout.tsx`](../src/app/layout.tsx)
- `head`에서 localStorage 기반 테마를 먼저 읽고 `data-theme-preference` 및 루트 배경을 즉시 맞춤

2. launch splash safe-area 분리
- [`components/app-launch-splash.tsx`](../src/components/app-launch-splash.tsx)
- splash는 `top: env(safe-area-inset-top, 0px)` 아래에서만 렌더

## 수정할 때 체크리스트

- 새 `fixed` overlay가 safe-area top까지 덮지 않는지
- top bar tint가 변하는 시점이 “첫 렌더 직후”인지, “모달 open/close 후”인지
- `html/body` 배경과 `data-theme-preference` 적용 순서가 바뀌지 않았는지
- iOS Safari 실기기에서 새로고침 직후와 모달 open/close 후 둘 다 확인했는지

## 관련 파일

- [`app/layout.tsx`](../src/app/layout.tsx)
- [`components/app-launch-splash.tsx`](../src/components/app-launch-splash.tsx)
- [`styles/base.css`](../src/styles/base.css)
- [`styles/layout.css`](../src/styles/layout.css)

## 참고

- WebKit bug 300965
- WebKit bug 301756
- WebKit bug 301108
