import { expect, test } from "@playwright/test";
import { iosSettingsComplianceTargets } from "./ios-settings-compliance.targets";

type ScreenMetrics = {
  groupedListCount: number;
  sectionCount: number;
  rowCount: number;
  footnoteCount: number;
  touchTargetCount: number;
  minTouchHeight: number;
  minPaddingInline: number;
  minSectionGap: number;
  bodyFontPx: number;
  titleFontPx: number;
  captionFontPx: number;
  titleColor: string;
  captionColor: string;
  surfaceColor: string;
  accentToken: string;
};

test.describe("iOS Settings compliance: layout/touch/typography/color", () => {
  for (const target of iosSettingsComplianceTargets) {
    test(`${target.id} (${target.path}) follows grouped-list rules`, async ({ page }) => {
      await page.goto(target.path);

      const metrics = await page.evaluate((): ScreenMetrics => {
        const root = document.documentElement;
        const groupedLists = Array.from(document.querySelectorAll<HTMLElement>("[data-settings-grouped-list='true']"));
        const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-settings-row]"));
        const touchTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-settings-touch-target='true']"));
        const sections = Array.from(document.querySelectorAll<HTMLElement>(".tab-screen > section"));
        const footnotes = Array.from(document.querySelectorAll<HTMLElement>("[data-settings-footnote='true']"));

        let minTouchHeight = Number.POSITIVE_INFINITY;
        for (const node of touchTargets) {
          const rect = node.getBoundingClientRect();
          minTouchHeight = Math.min(minTouchHeight, rect.height);
        }

        let minPaddingInline = Number.POSITIVE_INFINITY;
        for (const node of touchTargets) {
          const style = window.getComputedStyle(node);
          minPaddingInline = Math.min(minPaddingInline, parseFloat(style.paddingLeft), parseFloat(style.paddingRight));
        }

        let minSectionGap = Number.POSITIVE_INFINITY;
        for (let index = 1; index < sections.length; index += 1) {
          const prev = sections[index - 1].getBoundingClientRect();
          const next = sections[index].getBoundingClientRect();
          minSectionGap = Math.min(minSectionGap, next.top - prev.bottom);
        }

        const title = document.querySelector<HTMLElement>(".type-title, [data-settings-section-header='true'] h2");
        const caption = document.querySelector<HTMLElement>(".type-caption, [data-settings-footnote='true']");
        const bodyStyle = window.getComputedStyle(document.body);
        const titleStyle = title ? window.getComputedStyle(title) : bodyStyle;
        const captionStyle = caption ? window.getComputedStyle(caption) : bodyStyle;

        return {
          groupedListCount: groupedLists.length,
          sectionCount: sections.length,
          rowCount: rows.length,
          footnoteCount: footnotes.length,
          touchTargetCount: touchTargets.length,
          minTouchHeight: Number.isFinite(minTouchHeight) ? minTouchHeight : 0,
          minPaddingInline: Number.isFinite(minPaddingInline) ? minPaddingInline : 0,
          minSectionGap: Number.isFinite(minSectionGap) ? minSectionGap : 0,
          bodyFontPx: parseFloat(bodyStyle.fontSize),
          titleFontPx: parseFloat(titleStyle.fontSize),
          captionFontPx: parseFloat(captionStyle.fontSize),
          titleColor: titleStyle.color,
          captionColor: captionStyle.color,
          surfaceColor: bodyStyle.backgroundColor,
          accentToken: root.style.getPropertyValue("--accent-primary") || window.getComputedStyle(root).getPropertyValue("--accent-primary"),
        };
      });

      expect(metrics.groupedListCount).toBeGreaterThan(0);
      expect(metrics.rowCount).toBeGreaterThan(0);
      expect(metrics.touchTargetCount).toBeGreaterThan(0);
      expect(metrics.minTouchHeight).toBeGreaterThanOrEqual(44);
      expect(metrics.minPaddingInline).toBeGreaterThanOrEqual(12);

      expect(metrics.sectionCount).toBeGreaterThan(0);
      expect(metrics.footnoteCount).toBeGreaterThan(0);
      if (metrics.sectionCount > 1) {
        expect(metrics.minSectionGap).toBeGreaterThanOrEqual(8);
      }

      expect(metrics.bodyFontPx).toBeGreaterThanOrEqual(14);
      expect(metrics.titleFontPx).toBeGreaterThan(metrics.bodyFontPx);
      expect(metrics.captionFontPx).toBeGreaterThanOrEqual(12);
      expect(metrics.captionFontPx).toBeLessThan(metrics.titleFontPx);

      expect(metrics.titleColor).not.toEqual(metrics.captionColor);
      expect(metrics.surfaceColor).not.toEqual("rgba(0, 0, 0, 0)");
      expect(metrics.accentToken.trim().length).toBeGreaterThan(0);
    });
  }
});

test.describe("iOS Settings compliance: state patterns", () => {
  test("state sample page exposes loading/empty/error/disabled/notice rows", async ({ page }) => {
    await page.goto("/settings/state-samples");

    await page.getByRole("button", { name: "로딩 상태 켜기" }).click();
    await expect(page.getByText("불러오는 중")).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "빈 상태 보기" }).click();
    await expect(page.getByText("설정 값 없음")).toBeVisible();

    await page.getByRole("button", { name: "비활성 상태 보기" }).click();
    await expect(page.getByText("현재 사용할 수 없음")).toBeVisible();

    await page.getByRole("button", { name: "오류 상태 발생" }).click();
    await expect(page.getByText("요청을 완료하지 못했습니다")).toBeVisible();

    await page.getByRole("button", { name: "성공 안내 표시" }).click();
    await expect(page.getByText("설정이 정상적으로 저장되었습니다.")).toBeVisible();

    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByText("재시도 수행됨")).toBeVisible();
  });
});
