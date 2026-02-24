# UI Consistency Audit and Redesign Plan

## 1) Original Intent Reconstruction

### Core goal
- Fast workout logging and review flow with minimal navigation overhead.
- Most frequent path: `Today` logging, then `Plans` and `Stats`.

### Usage environment
- Mobile web first.
- One-hand operation, thumb-zone aware controls.
- Installable/PWA-friendly behavior with offline continuity.

### UX philosophy
- System-native feel over ornamental visuals.
- Predictable interaction patterns across screens.
- Progressive disclosure for advanced controls.

### Information hierarchy
- Primary: Today session actions and save.
- Secondary: plan generation and analytics.
- Tertiary: template editing, settings/export, diagnostics.

### Emotional tone
- Modern, clean, fluid.
- Calm depth and soft elevation.
- Strong readability in dark and light auto theme.

## 2) Deviation Report (Before Refactor)

### `/`
- Structure: Mostly aligned.
- Drift: typography scale not shared with other screens; ad-hoc spacing decimals.

### `/workout/today`
- Structure: Rich and complete.
- Drift: mixed semantic and utility colors; inconsistent badge styling; nested card visual noise.

### `/plans`
- Structure: Good for mobile flow.
- Drift: mixed button/card states; bottom sheet motion not consistently token-driven.

### `/stats`
- Structure: usable but visually detached from other screens.
- Drift: cards and controls used mixed transition patterns; inconsistent section rhythm.

### `/templates`
- Structure: functionally strong but dense.
- Drift: many local button/card variants; weak interaction consistency against other pages.

### `/calendar`
- Structure: matches intent.
- Drift: cell action targets below 44px; compact sizing harmed accessibility.

### `/settings`, `/settings/data`
- Structure: aligned.
- Drift: component usage partly legacy (`ui-card` only) and mixed interaction feedback.

### `/offline`, `/workout/session/[logId]`, error boundary
- Structure: functional.
- Drift: not using unified screen shell conventions; typography and spacing mismatch.

## 3) Drift Matrix

### Structural Drift
- Multiple screen container patterns (`mx-auto...`, `tab-screen`, `settings-screen`) not fully unified.
- Some utility pages bypassed the shell layout language.

### Visual Drift
- Semantic token names not fully normalized.
- Mixed badge colors and ad-hoc utility palettes.
- Inconsistent card depth layering on nested sections.

### Interaction Drift
- Touch targets below 44px in calendar cell actions.
- Partial haptic-style feedback adoption.
- Different button state patterns across screens.

### System Drift
- Inline style used in bottom nav.
- Motion timing mixed in historical classes.
- Theme values duplicated instead of centralized constants.

## 4) Unified Design System Spec (Single Source of Truth)

### Layout System
- Scale: **4pt system** (`--space-1`..`--space-12`).
- Max width: `--layout-max`, wide mode `--layout-max-wide`.
- Mobile-first safe-area aware shell and bottom navigation.
- Thumb-zone controls: interactive minimum target `--touch-target` (44px).

### Typography System
- Roles:
  - Display: `--font-display`
  - Title: `--font-title`
  - Subtitle: `--font-subtitle`
  - Body: `--font-body`
  - Caption: `--font-caption`
  - Micro: `--font-micro`
- Role classes: `.type-display`, `.type-title`, `.type-subtitle`, `.type-body`, `.type-caption`, `.type-micro`.
- Unified line-height and tracking tokens.

### Color System (Semantic)
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
- `--text-primary`, `--text-secondary`
- `--accent-primary`, `--accent-subtle`
- `--border-default`
- Auto theme with `prefers-color-scheme`; dark-first defaults, light override.

### Component System
- Cards: `motion-card` / `ui-card` backed by elevation tokens.
- Buttons: `ui-primary-button` + haptic feedback (`.haptic-tap`).
- Inputs/selects/textarea: shared field styling and focus ring.
- Bottom sheet: `.mobile-bottom-sheet*` with tokenized spring-like motion.
- Lists/tables: consistent card and border behavior.
- Status badges: `.ui-badge` variants (`success/warning/info/neutral`).

### Motion System
- Tokens:
  - `--duration-fast`
  - `--duration-normal`
  - `--duration-slow`
  - `--ease-standard`
  - `--ease-emphasized`
- Page/card/list transitions standardized via shared keyframes and tokens.
- Reduced-motion respected globally.

### Accessibility Baseline
- Interactive minimum target 44px.
- Focus-visible ring unified.
- Contrast kept with semantic text/background tokens.
- Reduced motion support enabled globally.

## 5) Applied Refactor Summary

### Tokens and architecture
- Replaced mixed visual variables with semantic token layer.
- Added 4pt spacing, typography, elevation, motion tokens.
- Added `theme` source in `src/lib/theme.ts` and linked viewport colors from one place.

### Component/library updates
- `PrimaryButton` extended with explicit variants and default haptic interaction.
- `Card` extended to use unified elevation model.
- Bottom nav inline style removed (no inline style rule).

### Screen-level normalization
- Unified structure and styling for:
  - offline screen
  - session detail screen
  - root error screen
  - templates/settings/calendar card/button interaction consistency
  - workout status badges moved to semantic component classes

## 6) Before/After Structural Comparison

### Before
- Multiple layout idioms and style entry points.
- Utility pages outside shared visual language.
- Partial motion/token adoption.

### After
- Shared container rhythm (`native-page` + screen classes).
- Shared semantic tokens and component classes across all routes.
- Consistent interaction and motion signatures.

## 7) Unified Component Map

- Shell: `AppShell`, `BottomNav`, `SyncStatusTray`, `PwaRegister`
- Surface: `Card` (`motion-card` / `ui-card`)
- Action: `PrimaryButton`, `.workout-action-pill`, nav tabs
- Input: shared field styles for `input/select/textarea`
- Overlay: `.mobile-bottom-sheet`, PWA banners
- Feedback: `.ui-badge-*`, sync tray states, error/success text

## 8) PR-Based Execution Roadmap

- PR1: semantic token foundation and theme source object
- PR2: typography and spacing normalization across shared classes
- PR3: button/card/input state unification
- PR4: navigation and shell consistency (no inline styles)
- PR5: screen-level cleanup (`offline/session/error/templates/calendar`)
- PR6: motion and gesture timing standardization
- PR7: accessibility pass (target sizes, focus, contrast verification)
- PR8: dark/light fine tuning and visual parity pass

## 9) Risk Assessment

- Low risk:
  - token additions and class-level style refactors.
  - screen wrapper normalization without logic changes.
- Medium risk:
  - dense template/workout screens may expose spacing regressions at extreme content lengths.
  - calendar cell resizing can increase vertical scroll.
- Mitigation:
  - each screen validated in production build.
  - route/API contracts unchanged.
  - interaction changes isolated to UI classes and component props.
