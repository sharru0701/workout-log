import { expect, test, type Page } from "@playwright/test";

type ThemeCase = {
  preference: string;
  dataValue: string;
  background: string;
};

const LIGHT_THEMES: ThemeCase[] = [
  { preference: "PAPER", dataValue: "paper", background: "#f6f1e8" },
  {
    preference: "GITHUB_LIGHT",
    dataValue: "github-light",
    background: "#f6f8fa",
  },
  {
    preference: "SOLARIZED_LIGHT",
    dataValue: "solarized-light",
    background: "#eee8d5",
  },
  {
    preference: "CATPPUCCIN_LATTE",
    dataValue: "catppuccin-latte",
    background: "#e6e9ef",
  },
  {
    preference: "TOKYO_NIGHT_DAY",
    dataValue: "tokyo-night-day",
    background: "#d0d5e3",
  },
  {
    preference: "GRUVBOX_LIGHT",
    dataValue: "gruvbox-light",
    background: "#ebdbb2",
  },
  {
    preference: "KANAGAWA_LOTUS",
    dataValue: "kanagawa-lotus",
    background: "#e5ddb0",
  },
];

const DARK_THEMES: ThemeCase[] = [
  { preference: "OBSIDIAN", dataValue: "obsidian", background: "#0e0d12" },
  {
    preference: "GITHUB_DARK",
    dataValue: "github-dark",
    background: "#0d1117",
  },
  {
    preference: "SOLARIZED_DARK",
    dataValue: "solarized-dark",
    background: "#002b36",
  },
  {
    preference: "CATPPUCCIN_MOCHA",
    dataValue: "catppuccin-mocha",
    background: "#11111b",
  },
  {
    preference: "TOKYO_NIGHT",
    dataValue: "tokyo-night",
    background: "#16161e",
  },
  {
    preference: "GRUVBOX_DARK",
    dataValue: "gruvbox-dark",
    background: "#1d2021",
  },
  {
    preference: "KANAGAWA_WAVE",
    dataValue: "kanagawa-wave",
    background: "#16161d",
  },
];

async function installThemePreferences(
  page: Page,
  preferences: { mode: "SYSTEM" | "LIGHT" | "DARK"; light: string; dark: string },
) {
  await page.addInitScript((values) => {
    const prefix = "workout-log.setting.v1.";
    window.localStorage.setItem(
      `${prefix}prefs.theme.mode`,
      JSON.stringify({ value: values.mode }),
    );
    window.localStorage.setItem(
      `${prefix}prefs.theme.light`,
      JSON.stringify({ value: values.light }),
    );
    window.localStorage.setItem(
      `${prefix}prefs.theme.dark`,
      JSON.stringify({ value: values.dark }),
    );
  }, preferences);
}

async function expectAppliedTheme(
  page: Page,
  expected: { mode: string; tone: "light" | "dark"; theme: ThemeCase },
) {
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme-preference", expected.mode);
  await expect(root).toHaveAttribute("data-theme-tone", expected.tone);
  await expect(root).toHaveAttribute("data-color-theme", expected.theme.dataValue);
  await expect
    .poll(() =>
      root.evaluate((element) =>
        window.getComputedStyle(element).getPropertyValue("--v2-bg").trim(),
      ),
    )
    .toBe(expected.theme.background);
}

test.describe("named color themes", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const theme of LIGHT_THEMES) {
    test(`applies light theme ${theme.dataValue} before hydration`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await installThemePreferences(page, {
        mode: "LIGHT",
        light: theme.preference,
        dark: "OBSIDIAN",
      });

      const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expectAppliedTheme(page, { mode: "light", tone: "light", theme });
      await page.waitForTimeout(100);
      expect(pageErrors).toEqual([]);
    });
  }

  for (const theme of DARK_THEMES) {
    test(`applies dark theme ${theme.dataValue} before hydration`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await installThemePreferences(page, {
        mode: "DARK",
        light: "PAPER",
        dark: theme.preference,
      });

      const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expectAppliedTheme(page, { mode: "dark", tone: "dark", theme });
      await page.waitForTimeout(100);
      expect(pageErrors).toEqual([]);
    });
  }

  test("system mode follows runtime color-scheme changes", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.emulateMedia({ colorScheme: "light" });
    await installThemePreferences(page, {
      mode: "SYSTEM",
      light: "GITHUB_LIGHT",
      dark: "TOKYO_NIGHT",
    });

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expectAppliedTheme(page, {
      mode: "system",
      tone: "light",
      theme: LIGHT_THEMES[1],
    });

    await page.emulateMedia({ colorScheme: "dark" });
    await expectAppliedTheme(page, {
      mode: "system",
      tone: "dark",
      theme: DARK_THEMES[4],
    });
    await page.waitForTimeout(100);
    expect(pageErrors).toEqual([]);
  });
});
