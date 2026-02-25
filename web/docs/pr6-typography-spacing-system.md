# PR6 Global Typography and Spacing System

## 1) Typography System 정의

### Type Scale
| Token | Value | 용도 |
| --- | --- | --- |
| `--type-scale-title-size` | `clamp(1.38rem, 1.6vw + 1rem, 1.76rem)` | 화면 타이틀 |
| `--type-scale-title-line-height` | `1.18` | 타이틀 줄간격 |
| `--type-scale-body-size` | `clamp(0.95rem, 0.42vw + 0.86rem, 1.03rem)` | 본문 기본 |
| `--type-scale-body-line-height` | `1.46` | 본문 줄간격 |
| `--type-scale-footnote-size` | `clamp(0.78rem, 0.28vw + 0.72rem, 0.86rem)` | Footnote/보조텍스트 |
| `--type-scale-footnote-line-height` | `1.34` | Footnote 줄간격 |

### Utility Classes
- `.type-title`: Title scale
- `.type-body`: Body scale
- `.type-footnote`, `.type-caption`: Footnote scale
- `.ui-card-label*`: Footnote 스케일로 통일

## 2) Spacing 규칙 정의

### Section Spacing
| Token | Value | 적용 |
| --- | --- | --- |
| `--space-screen-section-gap` | `0.88rem` (mobile `0.72rem`) | `.home-screen`, `.tab-screen`, `.settings-screen` 섹션 간격 |
| `--space-section-top-offset` | `0.16rem` | `header + section` 상단 여백 |

### Row Spacing
| Token | Value | 적용 |
| --- | --- | --- |
| `--settings-row-min-height` | `2.9em` | Row 최소 높이 통일 |
| `--settings-row-padding-inline` | `1rem` (mobile `0.9rem`) | Row 좌우 패딩 통일 |
| `--settings-row-padding-block` | `0.72em` (mobile `0.66em`) | Row 상하 패딩 통일 |
| `--settings-row-content-gap` | `0.72rem` | Row 내부 콘텐츠 간격 |

## 3) Global Style 코드 반영 파일
- `web/src/app/globals.css`
  - PR6 섹션 추가: iOS semantic color tokens + typography scale + spacing rules
- `web/src/components/ui/settings-list.module.css`
  - Row/Section typography를 global scale token 기반으로 변경
  - Row padding block token 적용
  - success/warning/critical 색상 token 기반으로 변경
- `web/src/components/ui/settings-list.tokens.ts`
  - Settings list 기본 token을 semantic color token 참조로 전환

## 4) 적용 전/후 시각적 변화 요약

### Before
- 타이포 스케일이 페이지/컴포넌트별로 혼재.
- 섹션 간격과 Row 패딩 값이 화면마다 달라 리듬이 불균일.
- 색상 의미가 `bg/text/accent` 중심의 단순 토큰에 의존.

### After
- Title / Body / Footnote 3단계 스케일을 전역 token으로 고정.
- 섹션 간격과 Row 내 패딩이 token 기반으로 일관화.
- iOS semantic color token(`label/fill/separator/tint/status`) 체계로 통합.
- Dynamic Type 친화적 단위(`clamp`, `em`) 적용으로 확대 시 가독성 안정화.
