import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { iosSettingsA11yTargets } from "./ios-settings-compliance.targets";

function toViolationText(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes.map((node) => node.target.join(" ")).join(" | ");
      return `${violation.id} (${violation.impact ?? "n/a"}): ${violation.help} -> ${nodes}`;
    })
    .join("\n");
}

test.describe("iOS Settings compliance: accessibility (axe)", () => {
  for (const target of iosSettingsA11yTargets) {
    test(`${target.id} (${target.path}) has no axe violations`, async ({ page }) => {
      await page.goto(target.path);

      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules(["color-contrast"])
        .analyze();

      expect(
        result.violations,
        result.violations.length > 0
          ? `A11y violations on ${target.path}\n${toViolationText(result.violations)}`
          : undefined,
      ).toEqual([]);
    });
  }
});
