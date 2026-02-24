import { expect, test, type Page } from "@playwright/test";

async function getActiveServiceWorkerScriptUrl(page: Page) {
  try {
    return await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.scriptURL ?? null;
    });
  } catch {
    return null;
  }
}

async function getTimeOrigin(page: Page) {
  try {
    return await page.evaluate(() => performance.timeOrigin);
  } catch {
    return null;
  }
}

test.describe("PWA service worker update", () => {
  test("activates a new service worker version after an update", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();

    await expect
      .poll(async () => getActiveServiceWorkerScriptUrl(page), {
        timeout: 20_000,
      })
      .toContain("/sw.js?v=");

    const beforeScriptUrl = await getActiveServiceWorkerScriptUrl(page);
    expect(beforeScriptUrl).toContain("/sw.js?v=");

    let beforeTimeOrigin: number | null = null;
    await expect
      .poll(async () => {
        beforeTimeOrigin = await getTimeOrigin(page);
        return beforeTimeOrigin;
      })
      .not.toBeNull();

    if (beforeTimeOrigin == null) {
      throw new Error("Failed to read initial performance.timeOrigin");
    }

    const nextVersion = `e2e-${Date.now()}`;

    const registerNewVersion = page
      .evaluate(async (version) => {
        await navigator.serviceWorker.register(`/sw.js?v=${version}`);
      }, nextVersion)
      .catch(() => {
        // A service worker controllerchange can reload the page before this resolves.
      });

    await Promise.all([
      registerNewVersion,
      expect
        .poll(
          async () => {
            const currentTimeOrigin = await getTimeOrigin(page);
            if (currentTimeOrigin == null) return false;
            return currentTimeOrigin !== beforeTimeOrigin;
          },
          { timeout: 20_000 },
        )
        .toBe(true),
    ]);

    await expect
      .poll(async () => getActiveServiceWorkerScriptUrl(page), {
        timeout: 20_000,
      })
      .toContain(`/sw.js?v=${nextVersion}`);
  });
});
