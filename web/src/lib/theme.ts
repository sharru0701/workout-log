import type { Viewport } from "next";

/* iOS 26 Liquid Glass color palette */
export const theme = {
  color: {
    dark: {
      bgPrimary: "#06080f",
      bgSecondary: "#0d1119",
      textPrimary: "#eef1fa",
      accentPrimary: "#1FDDCF",
    },
    light: {
      bgPrimary: "#f0f2f8",
      bgSecondary: "#ffffff",
      textPrimary: "#090b14",
      accentPrimary: "#009688",
    },
  },
  motion: {
    durationFast: 160,
    durationNormal: 250,
    durationSlow: 390,
  },
} as const;

export const viewportThemeColor: NonNullable<Viewport["themeColor"]> = "transparent";
