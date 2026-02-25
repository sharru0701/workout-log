#!/usr/bin/env node

const themes = {
  dark: {
    fillSurface: "#141d29",
    labelPrimary: "#edf3fb",
    labelSecondary: "#a8bbd2",
    tint: "#0a84ff",
    successText: "#30d158",
    warningText: "#ff9f0a",
    dangerText: "#ff453a",
  },
  light: {
    fillSurface: "#ffffff",
    labelPrimary: "#111111",
    labelSecondary: "#6b7280",
    tint: "#0067d8",
    successText: "#1e7a34",
    warningText: "#9a5b00",
    dangerText: "#b3261e",
  },
};

const checks = [
  { label: "Primary text", token: "labelPrimary", minRatio: 4.5 },
  { label: "Secondary text", token: "labelSecondary", minRatio: 4.5 },
  { label: "Tint text", token: "tint", minRatio: 4.5 },
  { label: "Success text", token: "successText", minRatio: 4.5 },
  { label: "Warning text", token: "warningText", minRatio: 4.5 },
  { label: "Danger text", token: "dangerText", minRatio: 4.5 },
];

function hexToRgb(hex) {
  const raw = hex.replace("#", "");
  const normalized = raw.length === 3 ? raw.split("").map((ch) => `${ch}${ch}`).join("") : raw;
  const parsed = Number.parseInt(normalized, 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function relativeChannel(value) {
  const normalized = value / 255;
  if (normalized <= 0.03928) return normalized / 12.92;
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * relativeChannel(r) + 0.7152 * relativeChannel(g) + 0.0722 * relativeChannel(b);
}

function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

let hasFailure = false;

for (const [themeName, tokens] of Object.entries(themes)) {
  console.log(`\n[${themeName}] background ${tokens.fillSurface}`);
  for (const check of checks) {
    const foreground = tokens[check.token];
    const ratio = contrastRatio(foreground, tokens.fillSurface);
    const passed = ratio >= check.minRatio;
    if (!passed) hasFailure = true;
    console.log(
      `- ${check.label.padEnd(14)} ${foreground} contrast ${ratio.toFixed(2)}:1 ${passed ? "PASS" : "FAIL"} (>= ${check.minRatio}:1)`,
    );
  }
}

if (hasFailure) {
  console.error("\nContrast checks failed.");
  process.exit(1);
}

console.log("\nAll contrast checks passed.");
