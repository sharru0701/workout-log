"use client";

import type { CSSProperties } from "react";

/**
 * Material Symbols(ligature) → 터미널 글리프 매핑.
 *
 * 터미널 테마에선 Material Symbols 폰트가 로드되지 않으므로(mono 체인),
 * 아이콘 이름을 mono 폰트에 안전하게 렌더되는 Unicode 글리프로 치환한다.
 * 매핑이 없는 아이콘은 GLYPH_FALLBACK("·")로 — tofu(□) 노출 방지.
 *
 * 의미가 분명하고 mono 폰트(Sarasa/JetBrains/Nerd) 커버가 확실한 글리프 우선.
 * 실기기 확인 후 점진 확장(현재 1차: 고빈도 핵심 아이콘).
 */
const MATERIAL_TO_GLYPH: Record<string, string> = {
  // ── 액션 ──
  close: "✕",
  cancel: "✕",
  clear: "✕",
  delete: "✕",
  delete_outline: "✕",
  search_off: "✕",
  playlist_remove: "✕",
  check: "✓",
  done: "✓",
  check_circle: "✓",
  task_alt: "✓",
  check_box: "✓",
  check_box_outline_blank: "·",
  add: "+",
  add_circle: "+",
  remove: "−",
  do_not_disturb_on: "−",
  edit: "✎",
  edit_note: "✎",
  search: "⌕",
  refresh: "↻",
  restart_alt: "↻",
  sync: "↻",
  cloud_sync: "↻",
  cloud_upload: "↑",
  play_arrow: "▶",
  swap_horiz: "⇄",
  tune: "≡",
  settings: "≡",
  logout: "⏻",

  // ── 방향/네비 ──
  arrow_back: "‹",
  chevron_left: "‹",
  navigate_before: "‹",
  arrow_forward: "›",
  chevron_right: "›",
  navigate_next: "›",
  expand_more: "▾",
  keyboard_arrow_down: "▾",
  arrow_drop_down: "▾",
  expand_less: "▴",
  keyboard_arrow_up: "▴",
  arrow_drop_up: "▴",
  more_horiz: "…",
  more_vert: "⋮",

  // ── 의미/지표 ──
  mail: "@",
  workspace_premium: "★",
  star: "★",
  trending_up: "↗",
  trending_down: "↘",
  trending_flat: "→",
  warning: "!",
  error: "!",
  report: "!",
  info: "i",
  terminal: "▸",

  // ── 확장: cascade/위젯 아이콘 (geometric/화살표 — mono 커버 양호) ──
  calendar_month: "▦",
  calendar_today: "▦",
  today: "▦",
  event_note: "▦",
  event_repeat: "▦",
  date_range: "▦",
  show_chart: "▥",
  monitoring: "▥",
  leaderboard: "▥",
  equalizer: "▥",
  bar_chart: "▥",
  bolt: "↯",
  contrast: "◐",
  all_inclusive: "∞",
  track_changes: "◎",
  unfold_more: "▾",
  cloud_done: "✓",
  auto_awesome: "✦",
  open_in_new: "↗",
  launch: "↗",
};

export const GLYPH_FALLBACK = "·";

export function materialToTermGlyph(name: string): string {
  return MATERIAL_TO_GLYPH[name] ?? GLYPH_FALLBACK;
}

/**
 * 터미널 글리프 아이콘. Material span과 동일 자리에서 쓰되, 호출처가
 * skin === "terminal"일 때만 렌더한다(분기는 호출처 책임).
 * 색/크기는 style prop으로 — Material span의 스타일을 그대로 넘기면 정합.
 */
export function TermIcon({
  name,
  style,
  className,
}: {
  name: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        fontFamily: "var(--term-mono)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        ...style,
      }}
    >
      {materialToTermGlyph(name)}
    </span>
  );
}
