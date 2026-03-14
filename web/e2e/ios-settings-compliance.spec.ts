import { expect, test } from "@playwright/test";
import { iosSettingsComplianceTargets } from "./ios-settings-compliance.targets";

test.describe("iOS Settings compliance: HTML structure", () => {
  for (const target of iosSettingsComplianceTargets) {
    test(`${target.id} (${target.path}) has required grouped-list structure`, async ({ page }) => {
      await page.goto(target.path);

      const structure = await page.evaluate(() => {
        const groupedLists = document.querySelectorAll("[data-settings-grouped-list='true']");
        const rows = document.querySelectorAll("[data-settings-row]");
        const touchTargets = document.querySelectorAll("[data-settings-touch-target='true']");
        const sections = document.querySelectorAll(".tab-screen > section");

        return {
          groupedListCount: groupedLists.length,
          rowCount: rows.length,
          touchTargetCount: touchTargets.length,
          sectionCount: sections.length,
        };
      });

      expect(structure.groupedListCount).toBeGreaterThan(0);
      expect(structure.rowCount).toBeGreaterThan(0);
      expect(structure.touchTargetCount).toBeGreaterThan(0);
      expect(structure.sectionCount).toBeGreaterThan(0);
    });
  }
});
