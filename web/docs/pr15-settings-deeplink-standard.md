# PR15 Settings Deep Link Standard

Date: 2026-02-25  
Objective: 내부/외부에서 특정 설정 화면 또는 설정 Row로 일관되게 진입할 수 있는 딥링크 표준을 정의한다.

## 1) Route Schema

기본 경로
- `GET /settings/link/{key}`

옵션 파라미터
- `row`: 특정 Row 키 (선택)
- `source`: 유입 출처 (선택, 예: `search`, `external`)

예시
- 화면 진입: `/settings/link/settings.save-policy`
- Row 진입: `/settings/link/settings.save-policy?row=auto-sync`
- 검색 유입: `/settings/link/settings.save-policy?source=search`

호환 경로
- `GET /settings/link?key={key}&row={row}`
  - 내부적으로 canonical 경로(`/settings/link/{key}`)로 리다이렉트

## 2) Key/Target Resolution

- Resolver: `src/lib/settings/settings-deeplink.ts`
- Registry source: `src/lib/settings/settings-search-index.ts`
- 동작:
  1. `key` 유효성 검사
  2. 인덱스에서 target path 조회
  3. `row`가 있으면 `?row={row}` + `#row-{normalizedRow}` 부여
  4. 최종 target으로 redirect

예시 변환
- Input: `key=settings.save-policy`, `row=auto-sync`
- Output: `/settings/save-policy?row=auto-sync&source=deeplink#row-auto-sync`

## 3) Search Result Integration

검색 결과 이동도 동일 규칙 사용
- UI: `src/components/ui/settings-search-panel.tsx`
- 기존: `entry.path` 직접 이동
- 변경: `toSettingsDeepLinkHref({ key: entry.key, source: "search" })`

즉, 검색 결과 → 딥링크 resolver → 최종 설정 화면 진입 흐름으로 통일.

## 4) Invalid Deep Link UX (iOS tone)

404 대신 안내 화면 렌더링
- Component: `src/components/ui/settings-deeplink-invalid.tsx`
- Routes:
  - `src/app/settings/link/page.tsx` (key 누락 등)
  - `src/app/settings/link/[key]/page.tsx` (unknown key / invalid row)

안내 화면 구성
- `InfoRow`: 오류 유형 안내
- `ValueRow`: 요청 key/row 표시
- `NavigationRow`: 루트 검색(`/`) 또는 설정 목록(`/settings`)으로 복구 이동
- `SectionFootnote`: 올바른 딥링크 형식 안내

## 5) Row Anchor Rule

- Row anchor id 규칙: `row-{normalizedRowKey}`
- normalizer: 소문자 + `[a-z0-9_-]` 외 문자는 `-`로 치환

예시
- row key: `Prefs.Auto Sync`
- anchor id: `row-prefs-auto-sync`

적용 화면(샘플)
- `/settings`
- `/settings/data`
- `/settings/save-policy`
- `/settings/state-samples`

위 화면 Row에 `rowId`를 명시하여 hash 이동 시 해당 Row로 바로 진입 가능.
