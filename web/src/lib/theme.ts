import type { Viewport } from "next";

export const theme = {
  color: {
    dark: {
      bgPrimary: "#0b121c",
      bgSecondary: "#141d29",
      textPrimary: "#edf3fb",
      accentPrimary: "#55d4cd",
    },
    light: {
      bgPrimary: "#f3f6fb",
      bgSecondary: "#ffffff",
      textPrimary: "#111b2a",
      accentPrimary: "#147f78",
    },
  },
  motion: {
    durationFast: 160,
    durationNormal: 200,
    durationSlow: 240,
  },
} as const;

export const viewportThemeColor: NonNullable<Viewport["themeColor"]> = [
  { media: "(prefers-color-scheme: dark)", color: theme.color.dark.bgPrimary },
  { media: "(prefers-color-scheme: light)", color: theme.color.light.bgPrimary },
];
