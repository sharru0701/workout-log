# Stitch Design System — 구현 가이드

이 앱의 UI는 Google Stitch 기반 에디토리얼 디자인 시스템을 따릅니다.
새 화면을 추가하거나 기존 컴포넌트를 수정할 때 이 가이드를 기준으로 삼으세요.

> **소스**: `stitch/darkCode.txt`, `stitch/lightCode.txt` — 14개 화면 HTML 목업 (Tailwind + MD3 color tokens)
> **PRD**: `stitch/product_requirements_document_master.md` — IronGraph 2026, 43개 화면 체크리스트

---

## 0. 디자인 원칙 (PRD 발췌)

**IronGraph 2026 — Precision · Clarity · Speed**

전통적인 피트니스 앱의 게임화(gamified) 미학에서 벗어나, 고급 생산성 소프트웨어에서 영감을 받은 전문적이고 도구(tool)같은 경험을 목표로 합니다.

| 원칙 | 설명 |
|------|------|
| **Layered Elevation** | 무거운 그림자 대신 배경 색상 전환으로 계층 정의 |
| **Typography-First** | 운동 데이터(중량/횟수)의 가독성을 극대화한 타입 스케일 |
| **High-Density Utility** | 운동 중 화면은 최소 스크롤과 원-탭 액션 최적화 |
| **Tactile Feedback** | 모든 인터랙티브 요소에 최소 44×44px 터치 영역 |

---

## 1. 테마 시스템

### 1-1. 다크 테마 (GitHub Dark 영감)

```
Background:   #10141a   (page bg)
Surface:      #10141a   (= background, inner calculation base)
on-surface:   #dfe2eb   (primary text)
on-surface-variant: #c0c7d4  (secondary text)
outline:      #8b919d   (muted labels, meta)
outline-variant: #414752 (dividers, borders)

surface-container-lowest:  #0a0e14  ← 함몰 영역
surface-container-low:     #181c22  ← 카드 기본 ★
surface-container:         #1c2026  ← 중첩 카드
surface-container-high:    #262a31  ← 헤더 행, shimmer 하이라이트
surface-container-highest: #31353c  ← 최상위 강조
surface-bright:            #353940  ← hover state

primary:          #a2c9ff  (action blue — eyebrow, links, icons)
primary-container: #58a6ff (button fill)
on-primary:       #00315c  (text on primary)
secondary:        #67df70  (success/completion)
tertiary:         #fabc45  (PR 강조, 경고, 골드)
error:            #ffb4ab  (삭제, 실패)
```

> **앱 CSS 토큰 매핑**: `--color-primary` = `#58a6ff` (dark) / `#268bd2` (light)

### 1-2. 라이트 테마 (Solarized Light 영감)

```
background:   #FDF6E3   (warm paper)
surface:      #EEE8D5
on-surface:   #586E75   (primary text)
on-surface-variant: #93A1A1

surface-container-lowest:  #F6F0DF
surface-container-low:     #EEE8D5
surface-container:         #E6E0CB
surface-container-high:    #E0DAC1
surface-container-highest: #D6D1BC

primary:  #268BD2  (blue)
error:    #DC322F
tertiary: #B58900  (amber/gold)
outline:  #93A1A1
outline-variant: #C9C4B1
```

### 1-3. CSS 토큰 매핑 (앱 실제 사용)

```css
/* 배경 계층 */
var(--color-surface-container-lowest)
var(--color-surface-container-low)    ← 카드 기본
var(--color-surface-container)
var(--color-surface-container-high)
var(--color-surface-container-highest)

/* 텍스트 */
var(--color-text)           /* on-surface */
var(--color-text-muted)     /* on-surface-variant */
var(--color-text-subtle)    /* outline */
var(--color-border)         /* outline-variant */

/* 액션 */
var(--color-primary)        /* primary-container (#58a6ff dark) */
var(--color-action)         /* = --color-primary */
```

> **금지**: `var(--color-surface)` 컴포넌트 배경 직접 사용 → `var(--color-surface-container-low)`
> **금지**: `var(--color-cta)` (오렌지) 신규 액션 → `var(--color-action)`

---

## 2. 폰트

| 역할 | 폰트 | CSS 변수 |
|------|------|----------|
| 헤드라인 / 본문 | Inter | `var(--font-headline-family)` |
| 레이블 / 숫자 / 메트릭 | Space Grotesk | `var(--font-label-family)` |

### 폰트 토큰 shorthand

```css
var(--font-page-title)      /* 700 24px/1.2 Inter */
var(--font-section-title)   /* 600 20px/1.3 Inter */
var(--font-card-title)      /* 600 16px/1.4 Inter */
var(--font-body)            /* 400 16px/1.5 Inter */
var(--font-secondary)       /* 400 14px/1.5 Inter */
var(--font-numeric-metric)  /* 700 28px/1 Space Grotesk */
var(--font-label)           /* 500 12px/1 Space Grotesk */
```

### 소스 기반 타이포그래피 스케일

| 용도 | 폰트 | 크기 | weight | 기타 |
|------|------|------|--------|------|
| 페이지 대제목 | Inter | 4xl (36px) | extrabold (800) | `tracking-tight` |
| 섹션 제목 | Inter | xl (20px) | bold (700) | — |
| 카드 제목 | Inter | lg (18px) | bold (700) | — |
| Eyebrow | Space Grotesk | 10px | bold (700) | `tracking-[0.3em]` uppercase |
| 메트릭 큰 값 | Space Grotesk | 5xl (48px) / 3xl (30px) | bold (700) | `font-label` |
| 메트릭 단위 | Space Grotesk | xs (12px) | — | uppercase `tracking-widest` |
| 세트 번호 | Space Grotesk | 10px | light (300) | `font-light` |
| 표 헤더 | Space Grotesk | 10px | — | `tracking-widest` uppercase |
| 네비게이션 탭 | Inter | 10px | medium (500) | `tracking-widest` uppercase |

---

## 3. 에디토리얼 페이지 헤더

모든 최상위 페이지(`page.tsx`)는 동일한 에디토리얼 헤더 패턴을 사용합니다.

```tsx
<div style={{
  marginBottom: "var(--space-xl)",
  paddingBottom: "var(--space-md)",
  borderBottom: "1px solid var(--color-border)"
}}>
  {/* Eyebrow — Space Grotesk, 10px, tracking-[0.3em], uppercase, primary */}
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

## 4. 섹션 헤더 (h2)

페이지 내 각 섹션 구분에는 단일 `h2` 태그를 사용합니다.

```tsx
<h2 style={{
  fontFamily: "var(--font-headline-family)",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  margin: "0 0 var(--space-sm)"
}}>
  섹션명
</h2>
```

> **금지**: `fontSize: "9px"` eyebrow div를 섹션 레이블로 사용하는 패턴.
> 단, 카드 내부 stat 레이블(세트/시간/볼륨 등 수치 위의 라벨)은 10px `font-label` 유지.

소스 기준 섹션 헤더:
```
font-label text-xs uppercase tracking-widest text-outline font-bold
```

---

## 5. 아이콘

**Material Symbols Outlined** 만 사용합니다. 커스텀 SVG 아이콘을 새로 추가하지 않습니다.

```tsx
/* 기본 */
<span className="material-symbols-outlined">icon_name</span>

/* 굵기/채움 조절 */
<span
  className="material-symbols-outlined"
  style={{ fontSize: 24, fontVariationSettings: "'FILL' 0, 'wght' 400" }}
>
  icon_name
</span>
```

기본 CSS 초기값 (소스 기준):
```css
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
```

### 주요 아이콘 레퍼런스

| 용도 | 아이콘 |
|------|--------|
| 탐색 chevron | `chevron_right` |
| 탐색 forward | `arrow_forward_ios` |
| 뒤로가기 | `arrow_back` |
| 닫기 | `close` |
| 확인/완료 | `check` |
| 완료 (원형) | `check_circle` |
| 추가 | `add` / `add_circle` |
| 삭제 | `delete` |
| 편집 | `edit` |
| 검색 | `search` |
| 정보 | `info` |
| 설정 | `settings` |
| 달력 | `calendar_today` |
| 이력 | `history` |
| 위/아래 | `expand_less` / `expand_more` |
| 정렬 토글 | `unfold_more` |
| 공유 (iOS) | `ios_share` |
| 운동 시작 | `play_arrow` |
| PR 별 | `star` / `workspace_premium` |
| 불꽃 (스트릭) | `local_fire_department` |
| 통계 | `insights` |
| 다운로드 | `download` |
| 경고 | `warning` |
| 하트 | `favorite` |

### fontVariationSettings 가이드

```
'FILL' 0    → 아웃라인 (기본)
'FILL' 1    → 채움 (선택 상태, 완료 체크, 활성 탭)
'wght' 300  → 얇게 (장식용 대형 배경 아이콘)
'wght' 400  → 기본
'wght' 500  → 닫기/삭제 등 중요 액션
'wght' 600  → 확인 체크 등 강조
```

> **금지**: 새 SVG 아이콘 추가. 차트/그래프 등 데이터 시각화용 SVG는 예외.

---

## 6. 색상 사용 패턴

### 6-1. 시맨틱 색상 (도메인 전용)

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

### 6-2. PR / 특수 강조

- **PR 골드**: `color: var(--color-tertiary)` (tertiary = `#fabc45` dark / `#B58900` light)
- **성공/완료**: `color: var(--color-secondary)` (secondary = `#67df70` dark)
- **오류/삭제**: `color: var(--color-error)` (error = `#ffb4ab` dark / `#DC322F` light)

### 6-3. 카드 배경 계층 선택 기준

```
surface-container-lowest  → 카드 내부 세트 행 배경, 가장 함몰
surface-container-low     → 카드 기본 배경 ★ (가장 많이 사용)
surface-container         → 중첩 내부 카드
surface-container-high    → 헤더 행, shimmer 하이라이트, hover state
surface-container-highest → 최상위 강조 칩, inactive 탭
```

---

## 7. Card 컴포넌트

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

### 카드 radius 기준 (소스 기반)

```
rounded-xl  (12px)  → 일반 카드, 리스트 행
rounded-2xl (16px)  → 주요 컨텐츠 카드
rounded-3xl (24px)  → 헤더 배너, 모달 상단
rounded-lg  (8px)   → 버튼, 입력 필드, 소형 뱃지
rounded-full        → 칩, pill 버튼, 프로그레스 바
```

### Bento Grid (메트릭 타일)

소스에서 자주 쓰이는 2열 또는 2+1 그리드 레이아웃:

```tsx
<div style={{
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--space-md)"
}}>
  {/* wide tile (col-span-2) */}
  <div style={{
    gridColumn: "span 2",
    background: "var(--color-surface-container-low)",
    borderRadius: 12,
    padding: "var(--space-lg)"
  }}>
    <span style={{
      fontFamily: "var(--font-label-family)",
      fontSize: "10px", fontWeight: 400,
      textTransform: "uppercase", letterSpacing: "0.15em",
      color: "var(--color-text-subtle)"
    }}>Total Volume</span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{
        fontFamily: "var(--font-label-family)",
        fontSize: "48px", fontWeight: 700,
        color: "var(--color-primary)"
      }}>12,450</span>
      <span style={{
        fontFamily: "var(--font-label-family)",
        fontSize: "13px",
        color: "var(--color-text-subtle)"
      }}>kg</span>
    </div>
  </div>
  {/* narrow tile */}
  <div style={{
    background: "var(--color-surface-container-low)",
    borderRadius: 12,
    padding: "var(--space-lg)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 8
  }}>
    <span className="material-symbols-outlined" style={{
      color: "var(--color-tertiary)", fontSize: 28,
      fontVariationSettings: "'FILL' 1"
    }}>workspace_premium</span>
    <span style={{
      fontFamily: "var(--font-label-family)",
      fontSize: "24px", fontWeight: 700
    }}>3</span>
    <span style={{
      fontFamily: "var(--font-label-family)",
      fontSize: "10px", textTransform: "uppercase",
      letterSpacing: "0.15em",
      color: "var(--color-text-subtle)"
    }}>New PRs</span>
  </div>
</div>
```

---

## 8. 버튼 클래스

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

> **모드 토글, 필터 탭 선택 상태**: `btn-inline-action` + `btn-inline-action-primary` 조합 사용.

### 그라디언트 CTA (소스 원형 패턴 — 운동 시작 등 주요 액션)

```tsx
<button style={{
  width: "100%",
  padding: "16px",
  background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-container))",
  color: "var(--color-on-primary)",
  fontWeight: 700,
  borderRadius: 16,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  border: "none", cursor: "pointer",
  fontSize: "13px", letterSpacing: "0.05em", textTransform: "uppercase"
}}>
  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
    play_arrow
  </span>
  Start Session
</button>
```

---

## 9. 레이블 (Chip)

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

소스 기준 인라인 태그 스타일:
```tsx
<span style={{
  fontFamily: "var(--font-label-family)",
  fontSize: "10px",
  padding: "2px 8px",
  borderRadius: 4,
  background: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
  color: "var(--color-primary)",
  border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)"
}}>
  Chest
</span>
```

---

## 10. NavRow 패턴 (네비게이션 목록)

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
  }}>icon_name</span>

  {/* 텍스트 그룹 */}
  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
    {/* Eyebrow (선택) */}
    <div style={{
      fontFamily: "var(--font-label-family)", fontSize: "10px",
      fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
      color: "var(--color-primary)", marginBottom: "2px"
    }}>CATEGORY</div>
    {/* 제목 */}
    <div style={{
      fontFamily: "var(--font-headline-family)", fontSize: "16px",
      fontWeight: 700, color: "var(--color-text)"
    }}>메뉴 제목</div>
    {/* 설명 (선택) */}
    <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "2px" }}>
      설명 문구
    </div>
  </div>

  {/* 우측 chevron */}
  <span className="material-symbols-outlined" style={{
    fontSize: 20, color: "var(--color-text-muted)",
    fontVariationSettings: "'wght' 400", flexShrink: 0
  }}>chevron_right</span>
</button>
```

소스에서는 `arrow_forward_ios` 아이콘도 사용:
```tsx
<span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-text-muted)" }}>
  arrow_forward_ios
</span>
```

### SettingRow 변형 (현재 값 표시)

```tsx
{/* 우측 — 현재값 + chevron */}
<div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
  <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>현재값</span>
  <span className="material-symbols-outlined" style={{
    fontSize: 18, color: "var(--color-text-muted)",
    fontVariationSettings: "'wght' 400"
  }}>chevron_right</span>
</div>
```

---

## 11. 리스트 행 (Exercise / Catalog Item)

소스 기준 운동 종목 리스트 행 패턴:

```tsx
<div style={{
  background: "var(--color-surface-container-low)",
  padding: "var(--space-md)",
  borderRadius: 12,
  display: "flex", alignItems: "center", justifyContent: "space-between",
  cursor: "pointer"
}}>
  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
    {/* 썸네일 or 아이콘 */}
    <div style={{
      width: 64, height: 64, borderRadius: 8,
      background: "var(--color-surface-container-lowest)",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <span className="material-symbols-outlined" style={{ color: "var(--color-text-muted)" }}>
        fitness_center
      </span>
    </div>
    <div>
      {/* 종목명 */}
      <div style={{
        fontFamily: "var(--font-headline-family)",
        fontSize: "18px", fontWeight: 700
      }}>Barbell Bench Press</div>
      {/* 태그 */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <span className="label label-primary label-sm">Chest</span>
        <span className="label label-neutral label-sm">Barbell</span>
      </div>
    </div>
  </div>
  <span className="material-symbols-outlined" style={{
    color: "var(--color-text-muted)", fontSize: 20
  }}>chevron_right</span>
</div>
```

---

## 12. BottomSheet 사용 패턴

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

소스 기준 시트 구조:
```
rounded-t-[2rem]          ← 상단 둥근 모서리
border-t border-outline-variant/15
grabber: w-12 h-1 bg-outline-variant/30 rounded-full (pt-4 pb-2)
header: px-8 py-4
content: px-8
```

### 시트 내 콘텐츠 레이아웃

```tsx
/* 섹션 구분 h2 */
<h2 style={{
  fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--color-text-muted)", margin: "0 0 var(--space-sm)"
}}>섹션명</h2>

/* 필드 레이블 */
<span style={{
  fontFamily: "var(--font-label-family)", fontSize: "11px", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--color-text-muted)"
}}>필드명</span>
```

---

## 13. 하단 네비게이션 바

소스 기준 패턴:

```
fixed bottom-0, z-50
rounded-t-3xl
border-t border-slate-200/15 dark:border-slate-800/15
bg-slate-50/85 dark:bg-slate-950/85
backdrop-blur-xl

각 탭:
  - 활성: text-blue-500 + drop-shadow-[0_0_8px_rgba(88,166,255,0.3)] + FILL 1
  - 비활성: text-slate-400 dark:text-slate-600
  - 레이블: font-['Inter'] text-[10px] uppercase tracking-widest font-medium mt-1
```

아이콘: `home`, `add_box`, `calendar_today`, `insights`, `settings`

---

## 14. 스켈레톤 로딩

```tsx
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

/* @keyframes skeleton-shimmer {
     0%   { background-position: 200% 0; }
     100% { background-position: -200% 0; }
   } */
```

---

## 15. 간격 시스템

```css
var(--space-xs): 4px
var(--space-sm): 8px
var(--space-md): 16px   ← 기본 패딩/갭
var(--space-lg): 24px
var(--space-xl): 32px
var(--touch-target): 44px  ← 최소 터치 영역
```

PRD 기준: 4px 그리드 시스템 (4, 8, 12, 16, 24, 32).
카드 radius: `12px` 기본 / 버튼·입력: `8px` / 소형 뱃지: `4px`.

---

## 16. 운동 데이터 정보 분류 (PRD)

운동 중 화면에서 즉각적인 스캔을 위한 시각 처리:

| 요소 | 처리 |
|------|------|
| 종목명 | semi-bold, primary text, 18px+ |
| 세트 번호 | Space Grotesk, secondary text, 원형 뱃지 |
| 주요 메트릭 (횟수/중량) | bold, large, 고대비 |
| RPE | 기울임 secondary or 색상 뱃지 (RPE 9+: amber) |
| 완료 상태 | 전체 행 배경 변경 + 체크 아이콘 |
| 휴식/타이머 | Space Grotesk, dimmed primary, 프로그레스 링 |
| PR/1RM | 골드 아이콘 + semi-bold weight |

---

## 17. 금지 패턴 요약

| 금지 | 대체 |
|------|------|
| `var(--color-surface)` 컴포넌트 배경 직접 사용 | `var(--color-surface-container-low)` |
| `var(--color-cta)` 신규 액션 버튼 | `var(--color-action)` |
| 커스텀 SVG UI 아이콘 신규 추가 | Material Symbols Outlined |
| `DashboardScreen`, `DashboardActionSection` 컴포넌트 | NavRow 패턴 또는 Card |
| `fontSize: "9px"` div를 섹션 헤더로 사용 | `<h2>` Stitch 섹션 헤더 패턴 |
| `CardHeader` / `CardTitle` / `CardDescription` 섹션 헤더 | `<h2>` Stitch 패턴 또는 인라인 스타일 |
| `+` 텍스트 추가 버튼 | Material Symbol `add` |
| `--color-surface-2` (존재하지 않는 토큰) | `--color-surface-container-high` |
| `dashboard-surface-btn` (삭제된 CSS 클래스) | `btn` 또는 인라인 스타일 |

---

## 18. 프로그램 스토어 카드 패턴

`program-store/page.tsx`의 `ProgramListCard` 컴포넌트 기준.

### 카드 구조

```
┌─────────────────────────────────────┐
│ [뱃지]                   [태그 1-2] │
│ 프로그램명 (20px 800)               │
│ 부제목 (13px text-muted)            │
├─────────────────────────────────────┤
│ 설명 (2줄 clamp)                    │
├─────────────────────────────────────┤
│ ╔════════════════════════════════╗  │
│ ║ 기간 · 빈도 · 난이도 메타 행  ║  │
│ ╚════════════════════════════════╝  │
├─────────────────────────────────────┤
│ 강도 바 ████░  [시작하기 버튼]      │
└─────────────────────────────────────┘
```

### 강도 인디케이터 (5단계 세그먼트 바)

```tsx
const intensityMap = { "초급": 2, "중급": 3, "고급": 4, "일반": 3 };
const intensityFill = intensityMap[levelLabel] ?? 3;

<div style={{ display: "flex", gap: 3 }}>
  {[1,2,3,4,5].map(i => (
    <div key={i} style={{
      height: 6, flex: 1, borderRadius: 9999,
      background: i <= intensityFill ? "var(--color-primary)" : "var(--color-surface-container-highest)",
    }} />
  ))}
</div>
```

### 카테고리 필터 칩 (가로 스크롤)

```tsx
const STORE_CATEGORIES = [
  { key: "all", label: "전체" },
  { key: "strength", label: "근력" },
  { key: "hypertrophy", label: "근비대" },
  { key: "beginner", label: "입문" },
  { key: "endurance", label: "지구력" },
];

// 활성 칩: background var(--color-primary-container), color var(--color-on-primary)
// 비활성 칩: background var(--color-surface-container-low), border var(--color-border)
// borderRadius: 9999 (pill), font-label, 11px, 700, uppercase
```

### 뱃지 시맨틱 색상

| 상태 | 레이블 | 배경 | 텍스트 |
|------|--------|------|--------|
| MARKET 일반 | 공식 | primary 15% mix | `--color-primary` |
| MARKET + beginner 태그 | 입문 추천 | tertiary 15% mix | `--color-tertiary` |
| CUSTOM | 커스텀 | secondary 15% mix | `--color-secondary` |

### 메타 정보 추출 (`getProgramDetailInfo` 활용)

| stat label | 용도 |
|------------|------|
| `난이도` | 레벨 표시 + 강도 바 계산 |
| `주간 빈도` | 빈도 표시 |
| `사이클` / `기간` | 기간 표시 |
| `분할` | 빈도 fallback |

---

## 20. 43개 화면 체크리스트 (PRD)

1. Home (/)
2. Workout Log main
3. Today's workout
4. Calendar main
5. Stats main
6. Settings main
7. Workout overrides
8. Session detail
9. Legacy session detail
10. Add exercise modal
11. Exercise catalog modal
12. SearchSelectSheet (Workout)
13. NumberPickerSheet
14. FailureProtocolSheet
15. Calendar options
16. Calendar picker variant
17. Calendar select variant
18. MonthYearPickerSheet
19. Plan selection SearchSelectSheet
20. 1RM / stats filter sheet
21. Theme settings sheet
22. Minimum plate settings sheet
23. Bodyweight settings sheet
24. Exercise management sheet
25. Data export sheet
26. Data management sheet
27. About sheet
28. Save policy sheet
29. UX thresholds sheet
30. System stats sheet
31. Selection template sheet
32. Deep link settings
33. Plans manage
34. Plans history
35. Plans create guide
36. Plans context
37. Plans context picker
38. Plans context select
39. Program Store main
40. Program action bottom sheet
41. Templates manage
42. Global confirmation dialog
43. Global alert dialog

---

## 21. 파일 구조 참조

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

stitch/
├── darkCode.txt            ← 다크 테마 14개 화면 HTML 목업 (소스)
├── lightCode.txt           ← 라이트 테마 14개 화면 HTML 목업 (소스)
└── product_requirements_document_master.md  ← IronGraph 2026 PRD
```
