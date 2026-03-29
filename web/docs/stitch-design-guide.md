# Stitch Design System — 구현 가이드

이 앱의 UI는 Google Stitch 기반 에디토리얼 디자인 시스템을 따릅니다.
새 화면을 추가하거나 기존 컴포넌트를 수정할 때 이 가이드를 기준으로 삼으세요.

---

## 1. 폰트

| 용도 | 폰트 | CSS 변수 |
|------|------|----------|
| 헤드라인 / 본문 | Inter | `var(--font-headline-family)` |
| 레이블 / 숫자 | Space Grotesk | `var(--font-label-family)` |

### 폰트 토큰 (shorthand)

```css
var(--font-page-title)      /* 700 24px/1.2 Inter */
var(--font-section-title)   /* 600 20px/1.3 Inter */
var(--font-card-title)      /* 600 16px/1.4 Inter */
var(--font-body)            /* 400 16px/1.5 Inter */
var(--font-secondary)       /* 400 14px/1.5 Inter */
var(--font-numeric-metric)  /* 700 28px/1 Space Grotesk */
var(--font-label)           /* 500 12px/1 Space Grotesk */
```

---

## 2. 에디토리얼 페이지 헤더

모든 최상위 페이지(`page.tsx`)는 동일한 에디토리얼 헤더 패턴을 사용합니다.

```tsx
<div style={{
  marginBottom: "var(--space-xl)",
  paddingBottom: "var(--space-md)",
  borderBottom: "1px solid var(--color-border)"
}}>
  {/* Eyebrow — Space Grotesk, 10px, uppercase, primary blue */}
  <div style={{
    fontFamily: "var(--font-label-family)",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--color-primary)",
    marginBottom: "4px"
  }}>
    Section Name
  </div>

  {/* H1 — Inter, 28px, 800 weight */}
  <h1 style={{
    fontFamily: "var(--font-headline-family)",
    fontSize: "28px",
    fontWeight: 800,
    letterSpacing: "-0.5px",
    color: "var(--color-text)",
    margin: "0 0 var(--space-sm)"
  }}>
    페이지 제목
  </h1>

  {/* 선택적 설명 */}
  <p style={{
    fontSize: "13px",
    color: "var(--color-text-muted)",
    margin: 0,
    lineHeight: 1.5
  }}>
    페이지 설명 문구
  </p>
</div>
```

---

## 3. 섹션 헤더 (h2)

페이지 내 각 섹션 구분에는 단일 `h2` 태그를 사용합니다.
별도의 eyebrow 없이 h2 하나로 처리합니다.

```tsx
<h2 style={{
  fontFamily: "var(--font-headline-family)",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  margin: "0 0 var(--space-sm)"  /* 아래 콘텐츠와 간격 */
}}>
  섹션명
</h2>
```

> **금지**: `fontSize: "9px"` eyebrow div를 섹션 레이블로 사용하는 패턴.
> 단, 카드 내부 stat 레이블(세트/시간/볼륨 등 수치 위의 라벨)은 9px 유지 가능.

---

## 4. 색상 토큰

### 4-1. 액션 색상 — Primary Blue

```css
--color-primary: #268bd2 (light) / #58a6ff (dark)
--color-action: var(--color-primary)          /* 버튼, 활성 상태 */
--color-action-strong: var(--color-primary-strong)
--color-action-weak: color-mix(...)           /* 선택된 배경 등 */
```

> **금지**: `--color-cta` (오렌지)를 새 UI 요소의 primary action으로 사용하지 않습니다.
> `--color-cta`는 레거시 토큰으로 존재만 하며, 신규 컴포넌트에서는 `--color-action` 사용.

### 4-2. Surface Container 계층

MD3 기반 5단계 surface 계층을 사용합니다. 카드/행 배경은 반드시 이 계층에서 선택하세요.

```
lowest  → 페이지 배경보다 더 낮은 함몰 영역
low     → 카드, 리스트 행 기본 배경 ← 가장 많이 사용
         (var(--color-surface-container-low))
default → 내부 중첩 카드, 섹션 구분
high    → 스켈레톤 shimmer의 하이라이트, 헤더 행
highest → 최상위 강조 배경
```

**카드 기본 배경**: `var(--color-surface-container-low)`
**스켈레톤 shimmer**:
```css
background: linear-gradient(
  90deg,
  var(--color-surface-container) 0%,
  var(--color-surface-container-high) 50%,
  var(--color-surface-container) 100%
);
```

> **금지**: `var(--color-surface)` 를 컴포넌트 배경으로 직접 사용하지 않습니다.
> `--color-surface`는 color-mix 계산의 base값으로만 tokens.css 내부에서 사용.

### 4-3. 텍스트 계층

```css
var(--color-text)          /* 본문 주요 텍스트 */
var(--color-text-muted)    /* 보조, 레이블, 플레이스홀더 */
var(--color-text-subtle)   /* 힌트, 비활성 */
var(--color-primary)       /* 링크, eyebrow, 강조 레이블 */
```

### 4-4. 시맨틱 텍스트 토큰 (운동 기록 도메인)

```css
var(--text-exercise-name)    /* 종목명 */
var(--text-plan-name)        /* 플랜/프로그램명 */
var(--text-session-name)     /* 세션명 */
var(--text-session-context)  /* 세션 메타(주차, 날짜 등) */
var(--text-metric-weight)    /* 중량(kg) — 파란색 */
var(--text-metric-reps)      /* 횟수 — 청록색 */
var(--text-metric-volume)    /* 볼륨 — 주황색 */
var(--text-meta)             /* 보조 설명 = --color-text-muted */
```

---

## 5. 아이콘

**Material Symbols Outlined** 만 사용합니다. 커스텀 SVG 아이콘을 새로 추가하지 않습니다.

```tsx
/* 기본 사용 */
<span className="material-symbols-outlined">icon_name</span>

/* 굵기/채움 조절 */
<span
  className="material-symbols-outlined"
  style={{
    fontSize: 24,
    fontVariationSettings: "'FILL' 0, 'wght' 400"
  }}
>
  icon_name
</span>
```

### 주요 아이콘 레퍼런스

| 용도 | 아이콘 |
|------|--------|
| 탐색 chevron | `chevron_right` |
| 닫기 | `close` |
| 확인/완료 | `check` |
| 추가 | `add` |
| 삭제 | `delete` |
| 편집 | `edit` |
| 검색 | `search` |
| 정보 | `info` |
| 설정 | `settings` |
| 달력 | `calendar_today` |
| 이력 | `history` |
| 위로/아래로 | `expand_less` / `expand_more` |
| 정렬 토글 | `unfold_more` |
| 공유 (iOS) | `ios_share` |
| 뒤로가기 chevron | `chevron_left` |

### fontVariationSettings 가이드

```
'FILL' 0    → 아웃라인 (기본)
'FILL' 1    → 채움 (선택된 상태, 완료 체크 등)
'wght' 300  → 얇게 (장식용 대형 아이콘)
'wght' 400  → 기본
'wght' 500  → 닫기/삭제 등 중요 액션
'wght' 600  → 확인 체크 등 강조
```

> **금지**: 새 SVG 아이콘 추가. 차트/그래프 등 데이터 시각화용 SVG는 예외.

---

## 6. Card 컴포넌트

```tsx
import { Card } from "@/components/ui/card";

/* 기본 */
<Card padding="md">...</Card>

/* tone 옵션 */
<Card tone="default">   /* --color-surface-container-low */
<Card tone="subtle">    /* 살짝 어두운 내부 카드 */
<Card tone="inset">     /* 중첩된 내부 섹션 */
<Card tone="accent">    /* 파란 강조 (primary 10%) */
<Card tone="danger">    /* 빨간 경고 */
<Card tone="success">   /* 초록 완료 */

/* 인터랙티브 */
<Card as="button" interactive onClick={...}>
```

---

## 7. 버튼 클래스

```html
<!-- 기본 버튼 -->
<button class="btn btn-primary">   <!-- 파란 주요 액션 -->
<button class="btn btn-secondary"> <!-- 회색 보조 -->
<button class="btn btn-danger">    <!-- 빨간 삭제 -->
<button class="btn btn-ghost">     <!-- 투명 텍스트 -->

<!-- 크기 -->
<button class="btn btn-lg">        <!-- 큰 버튼 -->
<button class="btn btn-full">      <!-- 전체 너비 -->

<!-- 아이콘 전용 (44×44 터치 타겟) -->
<button class="btn btn-icon">
<button class="btn btn-icon btn-icon-danger">

<!-- 인라인 액션 (pill 형태) -->
<button class="btn btn-inline-action">              <!-- 중립 -->
<button class="btn btn-inline-action btn-inline-action-primary">  <!-- 파란 활성 -->
<button class="btn btn-inline-action btn-inline-action-danger">   <!-- 빨간 -->
```

> 모드 토글, 필터 탭 등의 선택 상태는 `btn-inline-action` + `btn-inline-action-primary` 조합 사용.

---

## 8. 레이블 (Chip)

```html
<!-- 시맨틱 레이블 -->
<span class="label label-complete">완료</span>
<span class="label label-danger">삭제</span>
<span class="label label-warning">경고</span>
<span class="label label-primary">운동종목</span>
<span class="label label-program">프로그램</span>
<span class="label label-neutral">중립</span>

<!-- 태그 분류 (프로그램 태그용) -->
<span class="label label-tag-session label-sm">strength</span>
<span class="label label-tag-progression label-sm">linear</span>
<span class="label label-tag-amrap label-sm">amrap</span>
<span class="label label-tag-top-set label-sm">top-set</span>
<span class="label label-tag-beginner label-sm">beginner</span>
<span class="label label-tag-custom label-sm">custom</span>
<span class="label label-tag-manual label-sm">manual</span>

<!-- 크기 수정자 -->
<span class="label label-sm">소형</span>
```

---

## 9. NavRow 패턴 (네비게이션 목록)

설정/탐색 목록의 각 행은 NavRow 패턴을 사용합니다.

```tsx
<button type="button" style={{
  display: "flex", alignItems: "center",
  gap: "var(--space-md)", width: "100%",
  padding: "var(--space-md) 0",
  background: "none", border: "none", cursor: "pointer",
  borderBottom: "1px solid var(--color-border)"
}}>
  {/* 아이콘 */}
  <span className="material-symbols-outlined" style={{
    fontSize: 24, color: "var(--color-primary)",
    fontVariationSettings: "'wght' 400"
  }}>
    icon_name
  </span>

  {/* 텍스트 그룹 */}
  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
    {/* Eyebrow (선택) */}
    <div style={{
      fontFamily: "var(--font-label-family)", fontSize: "10px",
      fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
      color: "var(--color-primary)", marginBottom: "2px"
    }}>
      CATEGORY
    </div>
    {/* 제목 */}
    <div style={{
      fontFamily: "var(--font-headline-family)", fontSize: "16px",
      fontWeight: 700, color: "var(--color-text)"
    }}>
      메뉴 제목
    </div>
    {/* 설명 (선택) */}
    <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "2px" }}>
      설명 문구
    </div>
  </div>

  {/* 우측 chevron */}
  <span className="material-symbols-outlined" style={{
    fontSize: 20, color: "var(--color-text-muted)",
    fontVariationSettings: "'wght' 400", flexShrink: 0
  }}>
    chevron_right
  </span>
</button>
```

### SettingRow 변형 (현재 값 표시)

현재 설정값을 오른쪽에 표시할 때 chevron 대신 현재값 + chevron 조합 사용:

```tsx
{/* 우측 — 현재값 + chevron */}
<div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
  <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
    현재값
  </span>
  <span className="material-symbols-outlined" style={{
    fontSize: 18, color: "var(--color-text-muted)",
    fontVariationSettings: "'wght' 400"
  }}>
    chevron_right
  </span>
</div>
```

---

## 10. BottomSheet 사용 패턴

```tsx
import { BottomSheet } from "@/components/ui/bottom-sheet";

<BottomSheet
  open={Boolean(target)}
  title="시트 제목"
  description="부제목 또는 컨텍스트"
  onClose={() => setTarget(null)}
  closeLabel="닫기"
  primaryAction={{
    ariaLabel: "저장",
    onPress: handleSave,
    disabled: saving,
  }}
  footer={
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      <PrimaryButton variant="primary" fullWidth>주요 액션</PrimaryButton>
      <PrimaryButton variant="secondary" fullWidth>보조 액션</PrimaryButton>
    </div>
  }
>
  {/* 콘텐츠 */}
</BottomSheet>
```

### 시트 내 콘텐츠 레이아웃

```tsx
/* 섹션 구분 */
<h2 style={{
  fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--color-text-muted)", margin: "0 0 var(--space-sm)"
}}>
  섹션명
</h2>

/* 필드 레이블 */
<span style={{
  fontFamily: "var(--font-label-family)", fontSize: "11px", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--color-text-muted)"
}}>
  필드명
</span>
```

---

## 11. 스켈레톤 로딩

```tsx
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

/* @keyframes는 loading.tsx 또는 globals.css에서 정의 */
/* @keyframes skeleton-shimmer {
     0%   { background-position: 200% 0; }
     100% { background-position: -200% 0; }
   } */
```

---

## 12. 간격 시스템

```css
var(--space-xs): 4px
var(--space-sm): 8px
var(--space-md): 16px   ← 기본 패딩/갭
var(--space-lg): 24px
var(--space-xl): 32px
var(--touch-target): 44px  ← 최소 터치 영역
```

---

## 13. 금지 패턴 요약

| 금지 | 대체 |
|------|------|
| `var(--color-surface)` 컴포넌트 배경 직접 사용 | `var(--color-surface-container-low)` |
| `var(--color-cta)` 신규 액션 버튼 | `var(--color-action)` |
| 커스텀 SVG UI 아이콘 신규 추가 | Material Symbols Outlined |
| `DashboardScreen`, `DashboardActionSection` 컴포넌트 | NavRow 패턴 또는 Card |
| `fontSize: "9px"` div를 섹션 헤더로 사용 | `<h2>` Stitch 섹션 헤더 패턴 |
| `CardHeader` / `CardTitle` / `CardDescription` 섹션 헤더 | `<h2>` Stitch 패턴 또는 인라인 스타일 |
| `+` 텍스트 추가 버튼 | Material Symbol `add` |

---

## 14. 파일 구조 참조

```
web/src/
├── styles/
│   ├── tokens.css          ← 모든 색상/폰트/간격 토큰
│   ├── base.css            ← 기본 타이포그래피
│   └── components/
│       ├── button.css      ← .btn-* 클래스
│       ├── card.css        ← .card 클래스
│       ├── dashboard.css   ← .hd-* Stitch 레이아웃
│       └── ...
├── components/
│   └── ui/
│       ├── bottom-sheet.tsx
│       ├── sheet-header.tsx
│       ├── form-controls.tsx   ← AppTextInput, AppSelect, AppPlusMinusIcon
│       ├── search-input.tsx
│       ├── card.tsx
│       └── primary-button.tsx
└── app/
    └── [page]/page.tsx     ← 에디토리얼 헤더 + 섹션 h2 패턴 적용
```
