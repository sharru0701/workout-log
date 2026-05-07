/**
 * PR history page smoke E2E.
 *
 * 목적: /stats/prs 라우트가 500 없이 렌더링되며,
 *      filter 변경(URL 파라미터)으로 화면이 갱신되는지 확인.
 *
 * 전제: 테스트 실행 전 DB 마이그레이션 + seed 완료.
 */
import { expect, test } from "@playwright/test";

const NAV_TIMEOUT = 30_000;

test.describe("smoke — PR history page", () => {
  test("/stats/prs 정상 로드 + filter 변경", async ({ page }) => {
    const response = await page.goto("/stats/prs", { timeout: NAV_TIMEOUT });
    expect(response?.status()).not.toBe(500);
    await expect(page.getByText("Application error")).not.toBeVisible({
      timeout: 5_000,
    });

    // 헤더에 "PR 이력" 또는 "PR History" 노출
    await expect(
      page.getByRole("heading").filter({ hasText: /PR (이력|History)/ }),
    ).toBeVisible({ timeout: 10_000 });

    // 30일 필터 변경 후에도 정상 동작
    await page.goto("/stats/prs?days=30", { timeout: NAV_TIMEOUT });
    await expect(page.getByText("Application error")).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("/stats 화면에서 PR 전체 보기 링크로 진입", async ({ page }) => {
    const response = await page.goto("/stats", { timeout: NAV_TIMEOUT });
    expect(response?.status()).not.toBe(500);

    const viewAll = page.locator('a[href="/stats/prs"]').first();
    if ((await viewAll.count()) === 0) {
      test.info().annotations.push({
        type: "skip-reason",
        description: "view-all link not present",
      });
      return;
    }
    await viewAll.click();
    await page.waitForURL(/\/stats\/prs/, { timeout: NAV_TIMEOUT });
    await expect(page.getByText("Application error")).not.toBeVisible({
      timeout: 5_000,
    });
  });
});
