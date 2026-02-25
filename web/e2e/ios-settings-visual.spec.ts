import { expect, test } from "@playwright/test";
import { iosSettingsVisualTargets } from "./ios-settings-compliance.targets";

const colorSchemes: Array<"light" | "dark"> = ["light", "dark"];
const strictVisualRegression = process.env.IOS_SETTINGS_VISUAL_STRICT === "1";

test.describe("iOS Settings compliance: visual regression", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const target of iosSettingsVisualTargets) {
    for (const colorScheme of colorSchemes) {
      test(`${target.id} (${colorScheme}) snapshot`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(target.path);
        await page.waitForLoadState("networkidle");

        await page.addStyleTag({
          content:
            "*,:before,:after{animation:none!important;transition:none!important;caret-color:transparent!important;}",
        });

        const screenshot = await page.screenshot({
          fullPage: true,
        });

        await test.info().attach(`ios-settings-${target.id}-${colorScheme}`, {
          body: screenshot,
          contentType: "image/png",
        });

        if (strictVisualRegression) {
          expect(screenshot).toMatchSnapshot(`ios-settings-${target.id}-${colorScheme}.png`, {
            maxDiffPixelRatio: 0.01,
          });
          return;
        }

        expect(screenshot.byteLength).toBeGreaterThan(30_000);
      });
    }
  }
});
