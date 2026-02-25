export const settingsListTokenDefaults = {
  "--settings-section-header-padding-inline": "1rem",
  "--settings-section-header-gap": "0.2rem",
  "--settings-row-min-height": "max(44px, 2.75em)",
  "--settings-row-padding-block": "0.72em",
  "--settings-row-padding-inline": "1rem",
  "--settings-row-content-gap": "0.75rem",
  "--settings-group-radius": "1.05rem",
  "--settings-group-background": "var(--color-fill-surface, var(--bg-surface))",
  "--settings-group-border-color": "color-mix(in srgb, var(--color-separator, var(--border-subtle)) 58%, transparent)",
  "--settings-row-divider-color": "color-mix(in srgb, var(--color-separator, var(--border-subtle)) 52%, transparent)",
  "--settings-label-color": "var(--color-label-primary, var(--text-primary))",
  "--settings-description-color": "var(--color-label-secondary, var(--text-secondary))",
  "--settings-value-color": "color-mix(in srgb, var(--color-label-secondary, var(--text-secondary)) 88%, var(--color-label-primary, var(--text-primary)) 12%)",
  "--settings-chevron-color": "color-mix(in srgb, var(--color-label-secondary, var(--text-secondary)) 88%, transparent)",
  "--settings-subtitle-color": "color-mix(in srgb, var(--color-label-primary, var(--text-primary)) 82%, var(--color-label-secondary, var(--text-secondary)) 18%)",
  "--settings-row-icon-size": "1.8rem",
  "--settings-row-icon-radius": "0.48rem",
  "--settings-row-icon-font-size": "0.92rem",
  "--settings-badge-height": "1.15rem",
  "--settings-badge-radius": "999px",
  "--settings-badge-padding-inline": "0.4rem",
  "--settings-switch-off-color": "var(--color-switch-off, #8e8e93)",
  "--settings-switch-on-color": "var(--color-switch-on, #34c759)",
  "--settings-focus-ring-color": "color-mix(in srgb, var(--color-tint, var(--accent-primary)) 72%, transparent)",
} as const;

export type SettingsListTokenName = keyof typeof settingsListTokenDefaults;

export type SettingsListTokenOverrides = Partial<Record<SettingsListTokenName, string>>;
