export const settingsListTokenDefaults = {
  "--settings-section-header-padding-inline":
    "var(--screen-section-text-inset-inline, var(--screen-text-inset-inline, 1.3rem))",
  "--settings-section-header-gap": "0.22rem",
  "--settings-row-min-height": "max(50px, 3em)",
  "--settings-row-padding-block": "0.84em",
  "--settings-row-padding-inline": "1.1rem",
  "--settings-row-content-gap": "0.84rem",
  "--settings-group-radius": "1.68rem",
  "--settings-group-background": "color-mix(in srgb, var(--color-fill-surface, var(--bg-surface)) 94%, var(--color-fill-elevated, var(--bg-tertiary)) 6%)",
  "--settings-group-border-color": "color-mix(in srgb, var(--color-separator, var(--border-subtle)) 26%, transparent)",
  "--settings-row-divider-color": "color-mix(in srgb, var(--color-separator, var(--border-subtle)) 50%, transparent)",
  "--settings-row-divider-inset-start": "var(--settings-row-padding-inline)",
  "--settings-row-divider-inset-end": "var(--settings-row-padding-inline)",
  "--settings-label-color": "var(--color-label-primary, var(--text-primary))",
  "--settings-description-color": "var(--color-label-secondary, var(--text-secondary))",
  "--settings-value-color": "var(--color-label-secondary, var(--text-secondary))",
  "--settings-chevron-color": "var(--color-label-tertiary, var(--text-secondary))",
  "--settings-subtitle-color": "var(--color-label-secondary, var(--text-secondary))",
  "--settings-row-icon-size": "2.02rem",
  "--settings-row-icon-radius": "0.62rem",
  "--settings-row-icon-font-size": "0.98rem",
  "--settings-badge-height": "1.15rem",
  "--settings-badge-radius": "999px",
  "--settings-badge-padding-inline": "0.4rem",
  "--settings-switch-off-color": "var(--color-switch-off, #8e8e93)",
  "--settings-switch-on-color": "var(--color-switch-on, #34c759)",
  "--settings-focus-ring-color": "color-mix(in srgb, var(--color-tint, var(--accent-primary)) 72%, transparent)",
} as const;

export type SettingsListTokenName = keyof typeof settingsListTokenDefaults;

export type SettingsListTokenOverrides = Partial<Record<SettingsListTokenName, string>>;
