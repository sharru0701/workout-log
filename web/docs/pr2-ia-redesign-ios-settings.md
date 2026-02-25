# PR2 IA Redesign: iOS Settings Pattern

## 범위
- 목적: PR1 진단 결과를 기반으로 전체 앱 IA를 `루트 -> 카테고리 -> 상세설정` 구조로 재정렬.
- 기준 패턴: iOS Settings의 Inset Grouped List + Push Navigation.
- 제외: UI 스타일/컴포넌트 구현 변경(본 문서에서는 구조만 정의).

## 공통 IA 원칙
1. 루트 화면은 "카테고리 인덱스"만 제공한다.
2. 카테고리 화면은 "설정 Row 리스트"만 제공한다.
3. 상세 화면은 "단일 책임"만 다룬다.
4. 복합 편집/고급 옵션은 반드시 Push로 분해한다.
5. Bottom Sheet는 보조 액션만 허용하고, 핵심 기능의 진입점으로 사용하지 않는다.

## Row 타입 표준
| Row 타입 | 구조 | 용도 |
| --- | --- | --- |
| Navigation Row | `Label + Chevron(>)` | 하위 상세 화면으로 이동 |
| Value Row | `Label + Value + Chevron(>)` | 현재 상태 확인 후 상세 변경 |
| Toggle Row | `Label + Switch` | 화면 이탈 없이 on/off 변경 |
| Action Row | `Label (accent)` | 즉시 실행 액션 |
| Status Row | `Label + Status Badge` | 동기화/오프라인/생성 상태 표시 |

## 1) Before -> After 화면 트리 비교표

### Before (현재)
```text
/
├─ /workout/today                (생성/기록/오버라이드/비교/JSON 집중)
├─ /plans                        (생성/선택/생성미리보기 집중)
├─ /calendar                     (캘린더 + 생성 + 미리보기 집중)
├─ /stats                        (KPI + 필터 + 3개 상세테이블 집중)
├─ /templates                    (라이브러리 + 편집 + 버전관리 집중)
├─ /settings
│  └─ /settings/data
├─ /workout/session/[logId]
└─ /offline
```

### After (목표)
```text
/
├─ /training                     (카테고리)
│  ├─ /training/today            (오늘 상태 요약)
│  ├─ /training/today/generate   (세션 생성)
│  ├─ /training/today/log        (세트 기록)
│  ├─ /training/today/overrides  (세션 오버라이드)
│  ├─ /training/today/compare    (계획 vs 수행 비교)
│  ├─ /training/sessions         (저장 세션 목록)
│  └─ /training/sessions/[logId] (세션 상세)
├─ /programs                     (카테고리)
│  ├─ /programs/plans            (플랜 목록)
│  ├─ /programs/plans/create     (플랜 생성)
│  ├─ /programs/plans/[planId]   (플랜 컨텍스트/생성)
│  ├─ /programs/templates        (템플릿 목록)
│  ├─ /programs/templates/[slug] (템플릿 개요)
│  ├─ /programs/templates/[slug]/editor
│  └─ /programs/templates/[slug]/versions
├─ /insights                     (카테고리)
│  ├─ /insights/dashboard        (핵심 KPI)
│  ├─ /insights/filters          (범위/플랜/운동 필터)
│  ├─ /insights/volume           (볼륨 상세)
│  ├─ /insights/compliance       (순응도 상세)
│  └─ /insights/prs              (PR 상세)
├─ /schedule                     (카테고리)
│  ├─ /schedule/calendar         (캘린더 인덱스)
│  └─ /schedule/calendar/[date]  (날짜 상세: 생성/열기)
└─ /system                       (카테고리)
   ├─ /system/export             (데이터 내보내기)
   ├─ /system/offline-sync       (오프라인/동기화 상태)
   └─ /system/app                (앱/유틸 설정)
```

### Before -> After 매핑 테이블
| Before 화면 | 문제 | After 분해/재배치 |
| --- | --- | --- |
| `/workout/today` | 기능 과집중(생성+기록+오버라이드+비교+JSON) | `/training/today`, `/training/today/generate`, `/training/today/log`, `/training/today/overrides`, `/training/today/compare`, `/training/sessions` |
| `/plans` | 생성/선택/미리보기 혼재 | `/programs/plans`, `/programs/plans/create`, `/programs/plans/[planId]` |
| `/templates` | 라이브러리/편집/버전관리 혼재 | `/programs/templates`, `/programs/templates/[slug]`, `/programs/templates/[slug]/editor`, `/programs/templates/[slug]/versions` |
| `/stats` | KPI/필터/다중테이블 동시 노출 | `/insights/dashboard`, `/insights/filters`, `/insights/volume`, `/insights/compliance`, `/insights/prs` |
| `/calendar` | 캘린더+생성미리보기 혼합 | `/schedule/calendar`, `/schedule/calendar/[date]` |
| `/settings`, `/settings/data`, `/offline` | 시스템 기능 분산 | `/system`, `/system/export`, `/system/offline-sync`, `/system/app` |

## 2) 새 Navigation Stack 다이어그램

```mermaid
flowchart TD
  A[/Root: /\n카테고리 인덱스/] --> B[/training/]
  A --> C[/programs/]
  A --> D[/insights/]
  A --> E[/schedule/]
  A --> F[/system/]

  B --> B1[/training/today/]
  B1 --> B2[/training/today/generate/]
  B1 --> B3[/training/today/log/]
  B1 --> B4[/training/today/overrides/]
  B1 --> B5[/training/today/compare/]
  B --> B6[/training/sessions/]
  B6 --> B7[/training/sessions/[logId]/]

  C --> C1[/programs/plans/]
  C1 --> C2[/programs/plans/create/]
  C1 --> C3[/programs/plans/[planId]/]
  C --> C4[/programs/templates/]
  C4 --> C5[/programs/templates/[slug]/]
  C5 --> C6[/programs/templates/[slug]/editor/]
  C5 --> C7[/programs/templates/[slug]/versions/]

  D --> D1[/insights/dashboard/]
  D1 --> D2[/insights/filters/]
  D1 --> D3[/insights/volume/]
  D1 --> D4[/insights/compliance/]
  D1 --> D5[/insights/prs/]

  E --> E1[/schedule/calendar/]
  E1 --> E2[/schedule/calendar/[date]/]

  F --> F1[/system/export/]
  F --> F2[/system/offline-sync/]
  F --> F3[/system/app/]
```

## 3) 각 화면 역할 정의서

| 화면 | 레벨 | 역할 | 주요 Row 구성 | Push 대상 |
| --- | --- | --- | --- | --- |
| `/` | Root | 전체 기능 카테고리 인덱스 | Navigation Row(Training/Programs/Insights/Schedule/System) | 각 카테고리 |
| `/training` | Category | 운동 실행 흐름 진입점 | Value Row(오늘 플랜/날짜), Navigation Row(Generate/Log/Overrides/Compare/Sessions) | Training 상세 |
| `/training/today` | Detail | 오늘 컨텍스트 요약 | Status Row(online/offline), Value Row(plan/date), Navigation Row(생성/기록) | generate/log |
| `/training/today/generate` | Detail | 세션 생성 설정/실행 | Value Row(plan/date/week/day), Action Row(generate/apply) | compare/log |
| `/training/today/log` | Detail | 세트 입력/저장 | Navigation Row(set rows), Toggle Row(extra/completed), Action Row(save) | session detail |
| `/training/today/overrides` | Detail | 세션 오버라이드 관리 | Navigation Row(accessory/replace), Value Row(target block) | 하위 override 편집 |
| `/training/today/compare` | Detail | 계획 대비 수행 검토 | Value Row(summary), Navigation Row(row detail) | session detail |
| `/training/sessions` | Detail | 저장 세션 목록 | Navigation Row(session item), Value Row(date/status) | `/training/sessions/[logId]` |
| `/training/sessions/[logId]` | Detail | 단일 세션 리포트 | Value Row(log metadata), Navigation Row(compare rows) | 하위 row detail |
| `/programs` | Category | 프로그램 관리 진입점 | Navigation Row(plans/templates), Value Row(active plan) | programs 상세 |
| `/programs/plans` | Detail | 플랜 목록/선택 | Navigation Row(plan item), Action Row(create) | create/plan detail |
| `/programs/plans/create` | Detail | SINGLE/COMPOSITE/MANUAL 생성 | Value Row(type/template/version), Action Row(create) | plan detail |
| `/programs/plans/[planId]` | Detail | 플랜 컨텍스트/생성 | Value Row(startDate/timezone/key mode), Action Row(generate) | training/today |
| `/programs/templates` | Detail | 템플릿 라이브러리 | Navigation Row(public/private template), Action Row(fork) | template detail |
| `/programs/templates/[slug]` | Detail | 템플릿 개요 | Value Row(latest version/type/tags), Navigation Row(editor/versions) | editor/versions |
| `/programs/templates/[slug]/editor` | Detail | 템플릿 편집 | Navigation Row(manual session/logic params), Action Row(create version) | versions |
| `/programs/templates/[slug]/versions` | Detail | 버전 히스토리 | Navigation Row(version item), Value Row(changelog/date) | version detail |
| `/insights` | Category | 지표 분석 진입점 | Navigation Row(dashboard/filters), Value Row(active scope) | insights 상세 |
| `/insights/dashboard` | Detail | KPI 요약 | Value Row(e1RM/volume/compliance), Navigation Row(각 상세) | volume/compliance/prs |
| `/insights/filters` | Detail | 범위/필터 편집 | Value Row(plan/bucket/date/exercise), Action Row(apply/reset) | dashboard |
| `/insights/volume` | Detail | 볼륨 상세 분석 | Value Row(total/trend), Navigation Row(exercise breakdown) | exercise detail |
| `/insights/compliance` | Detail | 순응도 상세 분석 | Value Row(total/by plan), Navigation Row(plan detail) | plan detail |
| `/insights/prs` | Detail | PR 변화 상세 | Value Row(best/latest/improvement), Navigation Row(exercise detail) | exercise detail |
| `/schedule` | Category | 일정 기반 진입점 | Navigation Row(calendar), Value Row(current plan period) | calendar |
| `/schedule/calendar` | Detail | 월/주 캘린더 인덱스 | Navigation Row(date cell), Value Row(period) | `/schedule/calendar/[date]` |
| `/schedule/calendar/[date]` | Detail | 날짜 단위 액션 | Value Row(day context), Action Row(generate/open today) | training/today |
| `/system` | Category | 시스템/유틸 진입점 | Navigation Row(export/offline-sync/app) | system 상세 |
| `/system/export` | Detail | 내보내기 관리 | Action Row(JSON/CSV export) | 없음 |
| `/system/offline-sync` | Detail | 오프라인/동기화 상태 | Status Row(queue/sync), Action Row(sync now) | training/today |
| `/system/app` | Detail | 앱 도구/보조 설정 | Toggle Row/Navigation Row(유틸 설정) | 하위 app setting |

## 4) 제거되는 화면 / 통합되는 화면 목록

### 제거(경로 폐기)
| 대상 | 처리 |
| --- | --- |
| `/workout/today` 단일 메가 화면 | 분해 후 폐기 |
| `/plans` 단일 메가 화면 | 분해 후 폐기 |
| `/templates` 단일 메가 화면 | 분해 후 폐기 |
| `/stats` 단일 메가 화면 | 분해 후 폐기 |
| `/calendar` 단일 메가 화면 | 날짜 상세 분리 후 폐기 |
| `/settings/data` | `/system/export`로 통합 후 폐기 |
| `/offline` | `/system/offline-sync`로 통합 후 폐기 |

### 통합(기능 흡수)
| 기존 위치 | 통합 위치 |
| --- | --- |
| Today 하단 BottomSheet(Session overrides) | `/training/today/overrides` |
| Plans BottomSheet(Create Plan) | `/programs/plans/create` |
| Stats BottomSheet(Filters) | `/insights/filters` |
| Today/Plans의 JSON snapshot InlineDisclosure | 각 상세의 전용 Push 페이지(필요 시 developer scope) |
| Settings + Data Export 분리 | `/system` 카테고리 하위 상세로 통합 |

## 구현 가드레일 (PR2 범위)
1. 본 PR2는 경로/화면 책임/전환 구조 정의만 수행한다.
2. 컴포넌트/스타일/상호작용 UI 구현은 PR3 이후로 이관한다.
3. 기존 API 계약은 유지하고, 화면 분해에 따른 호출 지점만 재배치 대상으로 본다.
