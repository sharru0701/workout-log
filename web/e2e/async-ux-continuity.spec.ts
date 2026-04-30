import { expect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";

const delayedMs = 850;

type EndpointBody = unknown | ((url: URL) => unknown);

type MockEndpoint = {
  id: string;
  path: string | RegExp;
  method?: string;
  body: EndpointBody;
  status?: number;
  delayMs?: number;
};

type InstalledApiMocks = {
  assertHit: (id: string) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fulfillJson(route: Route, body: unknown, status = 200, delay = delayedMs) {
  await sleep(delay);
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

function endpointMatches(endpoint: MockEndpoint, request: Request, url: URL) {
  if (endpoint.method && request.method() !== endpoint.method) return false;
  if (typeof endpoint.path === "string") return url.pathname === endpoint.path;
  return endpoint.path.test(url.pathname);
}

async function installApiMocks(page: Page, endpoints: MockEndpoint[]): Promise<InstalledApiMocks> {
  const hitCountById = new Map<string, number>();

  await page.context().route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = endpoints.find((candidate) => endpointMatches(candidate, request, url));

    if (!endpoint) {
      await route.fulfill({
        status: 503,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          error: `Unmocked API request: ${request.method()} ${url.pathname}${url.search}`,
        }),
      });
      return;
    }

    hitCountById.set(endpoint.id, (hitCountById.get(endpoint.id) ?? 0) + 1);
    const payload = typeof endpoint.body === "function" ? endpoint.body(url) : endpoint.body;
    await fulfillJson(route, payload, endpoint.status ?? 200, endpoint.delayMs ?? delayedMs);
  });

  return {
    assertHit: (id: string) => {
      expect(hitCountById.get(id) ?? 0).toBeGreaterThan(0);
    },
  };
}

async function assertNeverVisibleDuring(locator: Locator, durationMs: number, sampleMs = 50) {
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    const visible = await locator.first().isVisible().catch(() => false);
    expect(visible).toBe(false);
    await locator.page().waitForTimeout(sampleMs);
  }
}

const commonEndpoints: MockEndpoint[] = [
  {
    id: "settings.snapshot",
    method: "GET",
    path: "/api/settings",
    delayMs: 120,
    body: { settings: {} },
  },
];

const plansManageEndpoints: MockEndpoint[] = [
  {
    id: "plans.list",
    method: "GET",
    path: "/api/plans",
    body: {
      items: [
        {
          id: "plan-1",
          userId: "dev",
          name: "Mock Plan",
          type: "SINGLE",
          rootProgramVersionId: "531-v1",
          params: {
            startDate: "2026-02-01",
            timezone: "Asia/Seoul",
            sessionKeyMode: "DATE",
          },
          createdAt: "2026-02-21T01:00:00.000Z",
        },
      ],
    },
  },
];

const statsDashboardEndpoints: MockEndpoint[] = [
  {
    id: "plans.list",
    method: "GET",
    path: "/api/plans",
    body: {
      items: [{ id: "plan-1", name: "Mock Plan", type: "SINGLE" }],
    },
  },
  {
    id: "stats.bundle",
    method: "GET",
    path: "/api/stats/bundle",
    body: {
      sessions30d: 24,
      tonnage30d: 12500,
      prs90d: [
        {
          exerciseId: "sq",
          exerciseName: "Back Squat",
          best: { date: "2026-03-01", e1rm: 195, weightKg: 170, reps: 3 },
          latest: { date: "2026-03-01", e1rm: 195, weightKg: 170, reps: 3 },
          improvement: 7,
        },
      ],
    },
  },
  {
    id: "options.exercises",
    method: "GET",
    path: "/api/exercises",
    body: {
      items: [
        { id: "sq-1", name: "Back Squat" },
        { id: "bp-1", name: "Bench Press" },
      ],
    },
  },
  {
    id: "stats.e1rm",
    method: "GET",
    path: "/api/stats/e1rm",
    body: {
      from: "2025-12-01",
      to: "2026-03-04",
      rangeDays: 90,
      exercise: "Back Squat",
      exerciseId: "sq-1",
      best: { date: "2026-03-01", e1rm: 195, weightKg: 170, reps: 3 },
      series: [
        { date: "2026-02-10", e1rm: 188, weightKg: 165, reps: 2 },
        { date: "2026-03-01", e1rm: 195, weightKg: 170, reps: 3 },
      ],
    },
  },
];

test.describe("async ux continuity: no empty-state flicker on delayed queries", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("plans/manage keeps empty state hidden until delayed data resolves", async ({ page }) => {
    const apiMocks = await installApiMocks(page, [...commonEndpoints, ...plansManageEndpoints]);

    await page.goto("/plans/manage", { waitUntil: "domcontentloaded" });

    const emptyStateLabel = page.getByText("플랜이 없습니다", { exact: true });
    await assertNeverVisibleDuring(emptyStateLabel, 760);

    await expect(page.getByText("Mock Plan")).toBeVisible();
    await expect(emptyStateLabel).toBeHidden();

    apiMocks.assertHit("settings.snapshot");
    apiMocks.assertHit("plans.list");
  });

  test("stats keeps analytic empty states hidden while delayed queries are in flight", async ({ page }) => {
    const apiMocks = await installApiMocks(page, [...commonEndpoints, ...statsDashboardEndpoints]);

    await page.goto("/stats", { waitUntil: "domcontentloaded" });

    const emptyStateLabel = page.getByText("운동종목이 없습니다", { exact: true });
    await assertNeverVisibleDuring(emptyStateLabel, 820);

    await expect(page.getByText("PR 기록 추적", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "e1RM 상세 추이" })).toBeVisible();
    await expect(emptyStateLabel).toBeHidden();

    apiMocks.assertHit("settings.snapshot");
    apiMocks.assertHit("plans.list");
    apiMocks.assertHit("stats.bundle");
    apiMocks.assertHit("stats.e1rm");
  });
});
