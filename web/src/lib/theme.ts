import type { Viewport } from "next";

// Color palette — dark: GitHub Dark, light: Solarized Light inspired.
// Must stay in sync with --color-bg in globals.css and THEME_COLOR_OVERRIDE in workout-preferences.ts.
export const theme = {
  color: {
    dark: {
      bgPrimary: "#0d1117",
      bgSecondary: "#161b22",
      textPrimary: "#e6edf3",
      accentPrimary: "#1FDDCF",
    },
    light: {
      bgPrimary: "#f3f6fb",
      bgSecondary: "#ffffff",
      textPrimary: "#24292f",
      accentPrimary: "#009688",
    },
  },
  motion: {
    durationFast: 160,
    durationNormal: 250,
    durationSlow: 390,
  },
} as const;

// These must stay in sync with --color-bg in :root and @media (prefers-color-scheme: light)
// in globals.css, and with the THEME_COLOR_OVERRIDE map in workout-preferences.ts.
export const viewportThemeColor: NonNullable<Viewport["themeColor"]> = [
  { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  { media: "(prefers-color-scheme: light)", color: "#f3f6fb" },
];
