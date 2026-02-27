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

async function clearServiceWorkersAndCaches(page: Page) {
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  });
}

async function registerServiceWorker(page: Page, version: string) {
  await page.evaluate(async (nextVersion) => {
    await navigator.serviceWorker.register(`/sw.js?v=${nextVersion}`);
  }, version);
}

test.describe("PWA service worker update", () => {
  test("activates a new service worker version after an update", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("list", { name: "Offline recovery" })).toBeVisible();

    await clearServiceWorkersAndCaches(page);
    const initialVersion = `e2e-initial-${Date.now()}`;
    await registerServiceWorker(page, initialVersion);

    await expect
      .poll(async () => getActiveServiceWorkerScriptUrl(page), {
        timeout: 20_000,
      })
      .toContain(`/sw.js?v=${initialVersion}`);

    const nextVersion = `e2e-next-${Date.now()}`;
    await registerServiceWorker(page, nextVersion);

    await expect
      .poll(async () => getActiveServiceWorkerScriptUrl(page), {
        timeout: 20_000,
      })
      .toContain(`/sw.js?v=${nextVersion}`);
  });
});
