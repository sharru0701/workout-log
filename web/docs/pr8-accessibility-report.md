# PR8 Accessibility Compliance Report

Date: 2026-02-25
Scope: Global UI + Settings List system (`web/src/app/globals.css`, `web/src/components/ui/settings-list.*`)

## 1) Accessibility Checklist

| Item | Status | Evidence |
| --- | --- | --- |
| Dynamic Type 대응 | PASS | Typography continues to use rem/clamp tokens and added `text-size-adjust: 100%` for iOS Safari scaling. Row and control dimensions now use size tokens that scale with text. |
| 다크모드 완전 대응 | PASS | `color-scheme: light dark` + explicit light/dark token overrides. Semantic color tokens now drive text/surface/interaction values in both schemes. |
| 터치 영역 최소 44pt | PASS | Added `--touch-target-min: 44px`; interactive controls and settings rows use `min-height: var(--touch-target)` or `max(44px, ...)`. |
| 명도 대비 점검 | PASS | Added contrast script (`scripts/a11y-contrast-check.mjs`) and updated light-mode tint/success/warning/danger text tokens to meet >= 4.5:1. |

## 2) Contrast Audit Result

Command:

```bash
pnpm --dir web run test:a11y:contrast
```

Summary:

- Dark theme background `#141d29`
  - Primary `#edf3fb`: `15.20:1`
  - Secondary `#a8bbd2`: `8.65:1`
  - Tint `#0a84ff`: `4.65:1`
  - Success `#30d158`: `8.39:1`
  - Warning `#ff9f0a`: `8.25:1`
  - Danger `#ff453a`: `4.98:1`
- Light theme background `#ffffff`
  - Primary `#111111`: `18.88:1`
  - Secondary `#6b7280`: `4.83:1`
  - Tint `#0067d8`: `5.34:1`
  - Success `#1e7a34`: `5.40:1`
  - Warning `#9a5b00`: `5.43:1`
  - Danger `#b3261e`: `6.54:1`

All checks passed at `>= 4.5:1`.

## 3) Code Changes

- Global accessibility layer added:
  - `web/src/app/globals.css`
  - Added touch target minimum, focus ring strengthening, color-scheme handling, contrast mode handling, and dynamic type baseline handling.
- Settings list accessibility alignment:
  - `web/src/components/ui/settings-list.tokens.ts`
  - `web/src/components/ui/settings-list.module.css`
  - Enforced 44px row minimum and high-contrast text/focus behavior.
- Minor interaction semantics fix:
  - `web/src/components/sync-status-tray.tsx`
  - Added `type="button"` and `aria-hidden` for decorative status dot.
- Added automated contrast checker:
  - `web/scripts/a11y-contrast-check.mjs`
  - `web/package.json` script: `test:a11y:contrast`

## 4) Test Method

### Automated checks

```bash
pnpm --dir web run test:a11y:contrast
pnpm --dir web exec tsc --noEmit
pnpm --dir web build
```

### Manual QA (recommended on iOS Safari / device)

1. Dynamic Type
   - Increase system/app text size and confirm section headers, row labels, values, and descriptions reflow without clipping.
2. Dark Mode
   - Toggle device/browser appearance (Light/Dark) and verify all surfaces/text/controls remain readable.
3. Touch Target
   - Check tappable rows, nav tabs, primary action buttons, and utility controls; each should have >= 44px vertical hit area.
4. Contrast
   - Enable higher contrast mode (`prefers-contrast: more`) and confirm secondary text + separators + focus rings become visibly stronger.

## 5) Residual Risk

- Full screen-reader flow regression (`VoiceOver` rotor sequence and landmark announcement order) is not yet automated and should be validated in a dedicated E2E a11y pass.
