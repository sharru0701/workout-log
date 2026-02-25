# PR12 Row Detail Style Guide

Date: 2026-02-25  
Goal: Refine row-level details to iOS Settings tone with restrained icon/color use.

## 1) Row Style Guide (Do / Don’t)

### Icon

Do
- Use `RowIcon` only (fixed size/radius/background rules).
- Keep icon symbol short (`1-2` chars) and legible.
- Use restrained tones by section:
  - Primary categories: `blue`, `green`, `tint`
  - System/meta rows: `neutral`
  - Exceptional rows only: `orange`

Don’t
- Don’t use ad-hoc icon containers per screen.
- Don’t mix arbitrary icon sizes/radius.
- Don’t over-saturate every row with strong accent colors.

### Secondary text

Do
- Keep secondary copy in description/subtitle only.
- Rely on secondary label tone token (`--settings-description-color`).
- Keep description concise; long text is automatically clamped to 2 lines.

Don’t
- Don’t style per-row secondary text with custom colors.
- Don’t allow 3+ line descriptive blocks inside one row.

### Subtitle row

Do
- Use `SubtitleRow` (or `subtitle` prop) only when the subtitle adds routing context.
- Typical usage: semantic qualifier like `Primary`, `Flow`, `Input`.

Don’t
- Don’t add subtitle to every row by default.
- Don’t duplicate subtitle and description with the same meaning.

### Badge

Do
- Use right-side small capsule only for rare emphasis (`NEW`, `!`).
- Use `badgeTone="accent"` or `badgeTone="warning"` sparingly.

Don’t
- Don’t use badge as a persistent status replacement.
- Don’t place multiple badges in one section unless critical.

## 2) Row Extension Implementation

### Component changes

- `src/components/ui/settings-list.tsx`
  - Added `RowIcon` component
  - Added `subtitle`, `badge`, `badgeTone` support across all row types
  - Added `SubtitleRow`
- `src/components/ui/settings-list.module.css`
  - Added unified icon/badge style rules and restrained tone classes
  - Enforced description 2-line clamp
  - Added subtitle typography/tone
- `src/components/ui/settings-list.tokens.ts`
  - Added icon/badge/subtitle tokens

### State row integration

- `src/components/ui/settings-state.tsx`
  - Applied `RowIcon` consistently for loading/empty/error/disabled/notice patterns

## 3) Whole-App Application (Row-based screens)

Applied to key grouped-list screens:
- `/` root categories
- `/plans`, `/plans/create`, `/plans/context`
- `/calendar`, `/calendar/options`
- `/stats`, `/stats/filters`
- `/templates`
- `/settings`, `/settings/data`, `/settings/state-samples`, `/settings/save-policy`
- `/offline`
- `/workout/today`, `/workout/today/overrides`

Also updated component example:
- `src/components/ui/settings-list.example.tsx`

