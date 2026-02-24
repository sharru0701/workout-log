# Mobile UX Restructure Plan (IA + Scroll Optimization)

## 0) Intent & Success Metrics

### Original intent reconstruction
- Primary user goals:
  - Log today’s workout quickly and reliably.
  - Generate sessions from active plans with minimal friction.
  - Check key trend metrics fast on mobile.
- Primary tasks (Top 3):
  - `Today`: generate session, log sets, save.
  - `Plans`: create/select plan and quick-generate.
  - `Stats`: read e1RM/Volume/Compliance summary.
- Secondary tasks:
  - Template editing/versioning.
  - Calendar date-based generation.
  - Data export/settings/offline diagnostics.
- Typical sessions:
  - Quick check (30–90s): today save + metric glance.
  - Deep work (5–15m): plan/template edits and historical review.
- Above-the-fold outcomes (mobile):
  - Where am I?
  - What is the next primary action?
  - Current state/status needed to act now.

### Success metrics (targets)
- Time-to-primary-action (TTPA):
  - `Today` page: <= 3s to first actionable control.
  - `Plans` page: <= 3s to “Create Plan” or plan “Quick Generate”.
  - `Stats` page: <= 2s to first metric read.
- Scroll depth reduction:
  - Reduce long screens to <= 2.5 viewport heights for primary flow.
- Tap count for primary task:
  - `Today save` must not increase (target same or lower).
- Error/confusion:
  - Fewer mis-taps from dense controls.
  - Clear separation of primary vs advanced actions.
- A11y baseline:
  - WCAG AA contrast.
  - Touch targets >= 44px.
  - Focus-visible and reduced-motion support.

## 1) Full Screen Audit (Inventory + Priority)

### Current screen inventory and depth (estimated)
- `/` Home: ~1.2–1.5 vh.
- `/workout/today`: ~6.5–8.5 vh (highest).
- `/templates`: ~7.5–10 vh (highest, especially manual editor).
- `/stats`: ~4.5–6 vh.
- `/plans`: ~3.2–4.2 vh.
- `/calendar`: ~3.5–5 vh (month mode).
- `/workout/session/[logId]`: ~2.8–3.8 vh.
- `/settings`, `/settings/data`, `/offline`: low.

### Screen-by-screen priority map (P0–P3)

#### `/workout/today`
- P0:
  - Online/offline sync status.
  - Plan + date selection.
  - Generate primary action.
  - Set rows + Save CTA.
- P1:
  - Recent sessions selector.
  - Secondary quick actions (repeat/apply planned).
- P2:
  - Session overrides block.
  - Generated snapshot summary.
- P3:
  - Full JSON dumps (exercises/blocks/manual/accessories).
  - Full compare table (planned vs performed).

#### `/templates`
- P0:
  - Search/filter + template list.
  - Select/fork template.
- P1:
  - Base version selection.
  - Create version CTA.
- P2:
  - Logic safe parameter edits.
- P3:
  - Large manual session/item/set editing surface.
  - Full version table details.

#### `/stats`
- P0:
  - Metric tiles (e1RM/Volume/Compliance).
  - Range toggle (7/30/90).
- P1:
  - Bucket/plan filters.
  - Sparkline.
- P2:
  - One detail table at a time.
- P3:
  - All detail tables rendered simultaneously.

#### `/plans`
- P0:
  - Plan cards + select + quick generate.
  - Create plan entry point.
- P1:
  - Selected plan generate panel.
- P2:
  - Context fields (user/timezone/week/day).
- P3:
  - Raw generated snapshot JSON.

#### `/calendar`
- P0:
  - Date grid + generate/open action.
  - Prev/Today/Next.
- P1:
  - Plan selection.
- P2:
  - Timezone/view mode controls.
- P3:
  - Raw generated session JSON preview.

#### `/workout/session/[logId]`
- P0:
  - Session summary and status counts.
- P1:
  - Planned vs performed table (top rows).
- P2:
  - Full table with all rows.
- P3:
  - Advanced diff details.

### Drift matrix
- Structural drift:
  - Single pages mixing multiple independent workflows (especially `today` and `templates`).
- Visual drift:
  - Dense blocks with same visual weight obscure hierarchy.
- Interaction drift:
  - Too many same-level actions visible at once.
- System drift:
  - Heavy P2/P3 content rendered by default, increasing perceived load.

### Scroll reduction opportunities
- `today`: move P2/P3 blocks behind accordion and sheet, keep save flow visible.
- `templates`: split “Library” and “Editor” into separate routes.
- `stats`: show one detail dataset at a time (segmented control + lazy mount).
- `plans`: collapse context by default; defer JSON output.
- `calendar`: default to week view, move filters/details into bottom sheet.

## 2) Cognitive-First Placement Optimization

### Applied principles
- Hick’s Law:
  - Reduce visible simultaneous choices by grouping secondary actions in one “Tools” surface.
- Progressive disclosure:
  - P2/P3 hidden by default using accordion/sheet.
- Recognition over recall:
  - Keep plan/date/status visible.
  - Move explanations behind “Details”.
- Serial position:
  - Primary CTA at top context area and bottom save zone.
- Mobile scan pattern:
  - Header -> state -> primary action -> content list -> deferred details.

### Updated hierarchy rationale (per key screen)
- `today`:
  - Top: status + plan/date + generate.
  - Middle: set logging list (primary work).
  - Bottom sticky: save.
  - Deferred: overrides/snapshot/advanced compare.
- `templates`:
  - Library-first entry screen.
  - Drill-down editor route for heavy edits.
  - Manual editor split into collapsible sections per session.
- `stats`:
  - Summary-first dashboard.
  - Detail mode switched by segment, one panel mounted.

## 3) Restructuring Strategy (Decision Tree Applied)

### Use accordion
- `today`: Session overrides, compare details, snapshot details.
- `templates`: manual session/item/set editor groups.
- `plans`: advanced context block.
- `stats`: optional filter details.

### Use bottom sheet
- `today`: secondary tools/actions and generated snapshot preview.
- `stats`: filters/sort/date range controls.
- `calendar`: plan/timezone/view controls.
- `plans`: already used for create plan (retain and standardize).

### Use screen split
- `templates`:
  - `/templates` (library)
  - `/templates/[slug]` (template overview + versions)
  - `/templates/[slug]/edit` (editor)
- optional:
  - `today` advanced analytics -> `/workout/session/[logId]` only.

### Use segmented control
- `stats` details:
  - `Volume` / `Compliance` / `PRs` (2–4 max rule respected).

## 4) Navigation and Flow Integrity

### Updated flow (text diagram)
- Primary flow: `BottomNav Today -> Generate -> Log Sets -> Save`.
- Plans flow: `BottomNav Plans -> Create/Fork/Select -> Quick Generate`.
- Stats flow: `BottomNav Stats -> Summary -> (optional) detail segment`.
- Template deep work: `Templates Library -> Template Overview -> Edit`.

### Back behavior rules
- Sheet open: back closes sheet first.
- Accordion state: preserved in-session.
- Route drill-down: browser back restores previous scroll/state for list screens.

### Primary task tap count (before -> after)
- `Today generate + save`: 3–5 -> 3–5 (no increase).
- `Plans quick generate`: 2–3 -> 2–3.
- `Stats quick check`: 1 -> 1.

## 5) Estimated Impact

### Scroll depth (estimated)
- `/workout/today`: 6.5–8.5 vh -> 2.3–3.0 vh primary surface.
- `/templates`: 7.5–10 vh -> 2.0–2.8 vh library, 2.5–3.5 vh editor.
- `/stats`: 4.5–6 vh -> 2.0–2.8 vh summary + active detail panel.
- `/plans`: 3.2–4.2 vh -> 1.8–2.5 vh.
- `/calendar`: 3.5–5 vh -> 2.2–3.2 vh (week-default + deferred filters).

## 6) Performance Optimization Plan

### Real performance
- Lazy mount P2/P3 content panels.
- Dynamic import heavy editors/charts on demand.
- Render one stats detail table at a time.
- Avoid always-rendered large `<pre>` blocks.
- Apply `content-visibility: auto` for long offscreen panels where safe.
- Keep animation to transform/opacity for sheet/accordion.

### Perceived performance
- Skeleton placeholders for deferred blocks.
- Immediate P0 rendering, deferred hydration for heavy sections.
- Lightweight inline summaries before opening details.

## 7) Accessibility and Usability Checklist

- Touch targets >= 44px for all tap actions.
- Focus-visible states on buttons/links/inputs.
- Accordion semantics:
  - `button` with `aria-expanded`, `aria-controls`.
- Bottom sheet semantics:
  - `role="dialog"`, accessible close button, escape/back close.
- Reduced motion:
  - keep existing `prefers-reduced-motion` overrides.
- Contrast:
  - verify semantic token pairs against WCAG AA.

## 8) Unified System Application Map

### Component mapping
- Disclosure:
  - `AccordionSection` for P2/P3 inline details.
  - `BottomSheet` for secondary workflows.
- Surfaces:
  - `Card` + `motion-card` only.
- Actions:
  - `PrimaryButton` + standardized secondary button variant.
- Feedback:
  - unified `ui-badge` states.

### Token usage map
- Spacing: `--space-*` only.
- Typography: `--font-*` role classes.
- Motion: `--duration-*`, `--ease-*` only.
- Colors: semantic tokens only (`bg/text/accent/border`).

## 9) PR Plan (Low-Risk, Reversible)

### PR1 — Audit docs + metrics + IA proposal
- Changes:
  - Add this IA/scroll optimization spec.
  - Add per-screen P0–P3 map and target metrics.
- Risk: Low.
- Test:
  - Review with product/design.

### PR2 — Token + spacing + typography normalization
- Changes:
  - Remove remaining ad-hoc spacing/type classes.
  - Enforce semantic roles in key screens.
- Risk: Low.
- Test:
  - Visual regression pass across all routes.

### PR3 — Core disclosure components
- Changes:
  - Implement reusable `AccordionSection`, `BottomSheet`, `InlineDisclosure`.
- Risk: Medium.
- Test:
  - Accessibility behavior (focus, aria, escape, back).

### PR4 — Navigation/flow adjustments
- Changes:
  - Sheet back behavior, state restore patterns.
  - Deep-link stable routing for split screens.
- Risk: Medium.
- Test:
  - Browser back, refresh, deep-link QA.

### PR5 — Screen restructuring (highest scroll first)
- Changes:
  - `today`, `templates`, `stats`, `plans`, `calendar` in priority order.
- Risk: Medium/High.
- Test:
  - Primary task tap-count and TTPA verification.

### PR6 — Performance pass
- Changes:
  - Lazy mount, dynamic import, table panelization/virtualization.
- Risk: Medium.
- Test:
  - Interaction smoothness + hydration timing checks.

### PR7 — Accessibility pass
- Changes:
  - ARIA audit, keyboard/focus audits, contrast corrections.
- Risk: Low.
- Test:
  - Screen reader + keyboard path verification.

### PR8 — Visual polish + cross-screen consistency QA
- Changes:
  - Final alignment of sheet behavior, disclosure wording, empty/loading/error patterns.
- Risk: Low.
- Test:
  - Full mobile matrix QA + regression sweep.

## 10) Risk and Regression Checklist

- Do not hide P0 actions behind disclosures.
- Do not increase taps for `Today` primary save flow.
- Prevent nested scroll traps in sheets.
- Ensure deep links continue to resolve and restore state.
- Verify sheet/accordion behavior under reduced-motion.
- Validate top/bottom safe-area handling on iOS Safari.
- Re-run build and route smoke tests after each PR.
