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

function buildVersionsPayload(slug: string) {
  return {
    template: {
      id: `${slug}-id`,
      slug,
      name: `${slug} program`,
      type: "LOGIC",
      visibility: slug === "private-template" ? "PRIVATE" : "PUBLIC",
      ownerUserId: slug === "private-template" ? "dev" : null,
      tags: ["strength"],
      latestVersion: {
        id: `${slug}-v2`,
        version: 2,
        definition: { schedule: { weeks: 4, sessionsPerWeek: 4 } },
        defaults: { tmPercent: 0.9 },
      },
    },
    versions: [
      {
        id: `${slug}-v2`,
        templateId: `${slug}-id`,
        version: 2,
        parentVersionId: `${slug}-v1`,
        definition: { schedule: { weeks: 4, sessionsPerWeek: 4 } },
        defaults: { tmPercent: 0.9 },
        changelog: "mock update",
        createdAt: "2026-02-28T03:00:00.000Z",
      },
    ],
  };
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
    id: "templates.list",
    method: "GET",
    path: "/api/templates",
    body: {
      items: [
        {
          id: "tpl-531",
          slug: "531",
          name: "5/3/1",
          type: "LOGIC",
          visibility: "PUBLIC",
          tags: ["strength"],
          latestVersion: {
            id: "531-v1",
            version: 1,
            definition: { schedule: { weeks: 4, sessionsPerWeek: 4 } },
          },
        },
        {
          id: "tpl-manual",
          slug: "manual",
          name: "Manual",
          type: "MANUAL",
          visibility: "PUBLIC",
          tags: ["manual"],
          latestVersion: {
            id: "manual-v1",
            version: 1,
            definition: { kind: "manual", sessions: [] },
          },
        },
      ],
    },
  },
  {
    id: "templates.versions",
    method: "GET",
    path: /^\/api\/templates\/[^/]+\/versions$/,
    body: (url) => {
      const slug = decodeURIComponent(url.pathname.split("/")[3] ?? "program");
      return buildVersionsPayload(slug);
    },
  },
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

const templatesManageEndpoints: MockEndpoint[] = [
  {
    id: "templates.list",
    method: "GET",
    path: "/api/templates",
    body: {
      items: [
        {
          id: "pub-1",
          slug: "pub-template",
          name: "Public Template",
          type: "LOGIC",
          visibility: "PUBLIC",
          tags: ["strength"],
          latestVersion: {
            id: "pub-v1",
            version: 1,
            definition: { schedule: { weeks: 4, sessionsPerWeek: 4 } },
          },
        },
        {
          id: "pri-1",
          slug: "private-template",
          name: "Private Template",
          type: "LOGIC",
          visibility: "PRIVATE",
          ownerUserId: "dev",
          tags: ["personal"],
          latestVersion: {
            id: "private-v2",
            version: 2,
            definition: { schedule: { weeks: 5, sessionsPerWeek: 3 } },
          },
        },
      ],
    },
  },
  {
    id: "templates.versions",
    method: "GET",
    path: /^\/api\/templates\/[^/]+\/versions$/,
    body: (url) => {
      const slug = decodeURIComponent(url.pathname.split("/")[3] ?? "template");
      return buildVersionsPayload(slug);
    },
  },
];

const statsDashboardEndpoints: MockEndpoint[] = [
  {
    id: "plans.list",
    method: "GET",
    path: "/api/plans",
    body: {
      items: [
        {
          id: "plan-1",
          name: "Mock Plan",
          type: "SINGLE",
        },
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
      exerciseId: null,
      best: {
        date: "2026-03-01",
        e1rm: 195,
        weightKg: 170,
        reps: 3,
      },
      series: [
        { date: "2026-02-10", e1rm: 188, weightKg: 165, reps: 2 },
        { date: "2026-03-01", e1rm: 195, weightKg: 170, reps: 3 },
      ],
    },
  },
  {
    id: "stats.volume",
    method: "GET",
    path: "/api/stats/volume",
    body: {
      from: "2025-12-01",
      to: "2026-03-04",
      rangeDays: 90,
      totals: { tonnage: 45200, reps: 980, sets: 260 },
      previousTotals: { tonnage: 43800, reps: 930, sets: 248 },
      trend: { tonnageDelta: 1400, repsDelta: 50, setsDelta: 12 },
      byExercise: [
        {
          exerciseId: "sq",
          exerciseName: "Back Squat",
          tonnage: 17000,
          reps: 320,
          sets: 84,
        },
      ],
    },
  },
  {
    id: "stats.compliance",
    method: "GET",
    path: "/api/stats/compliance",
    body: {
      from: "2025-12-01",
      to: "2026-03-04",
      rangeDays: 90,
      planId: null,
      planned: 54,
      done: 49,
      compliance: 0.9074,
      byPlan: [
        {
          planId: "plan-1",
          planName: "Mock Plan",
          planned: 54,
          done: 49,
          compliance: 0.9074,
        },
      ],
      previous: { planned: 51, done: 43, compliance: 0.8431 },
      trend: { complianceDelta: 0.0643, doneDelta: 6 },
    },
  },
  {
    id: "stats.volumeSeries",
    method: "GET",
    path: "/api/stats/volume-series",
    body: {
      from: "2025-12-01",
      to: "2026-03-04",
      rangeDays: 90,
      bucket: "week",
      exerciseId: null,
      exercise: "Back Squat",
      series: [
        { period: "2026-W08", tonnage: 5200, reps: 118, sets: 31 },
        { period: "2026-W09", tonnage: 5600, reps: 124, sets: 33 },
      ],
      byExercise: [
        {
          exerciseId: "sq",
          exerciseName: "Back Squat",
          totals: { tonnage: 10800, reps: 242, sets: 64 },
          series: [
            { period: "2026-W08", tonnage: 5200, reps: 118, sets: 31 },
            { period: "2026-W09", tonnage: 5600, reps: 124, sets: 33 },
          ],
        },
      ],
    },
  },
  {
    id: "stats.prs",
    method: "GET",
    path: "/api/stats/prs",
    body: {
      from: "2025-12-01",
      to: "2026-03-04",
      rangeDays: 90,
      items: [
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
    id: "stats.uxSnapshot",
    method: "GET",
    path: "/api/stats/ux-snapshot",
    body: {
      exportedAt: "2026-03-04T10:00:00.000Z",
      filters: {
        from: "2025-12-01",
        to: "2026-03-04",
        rangeDays: 90,
        planId: null,
        comparePrev: true,
        windowDays: [1, 7, 14],
        thresholdTargets: {
          saveFromGenerate: 0.65,
          saveSuccessFromClicks7d: 0.6,
          addAfterSheetOpen14d: 0.35,
        },
      },
      funnel: {
        from: "2025-12-01",
        to: "2026-03-04",
        rangeDays: 90,
        planId: null,
        totals: {
          generatedSessions: 120,
          savedLogs: 98,
          savedLogsWithGeneratedSession: 88,
          savedLogsWithExtraExercise: 31,
          totalSets: 1320,
          extraSets: 126,
          avgSetsPerLog: 13.5,
        },
        steps: [
          { id: "generated_sessions", label: "생성 세션", count: 120, conversionFromPrevious: null },
          { id: "saved_logs", label: "저장 로그", count: 98, conversionFromPrevious: 0.8167 },
          { id: "saved_logs_with_extra", label: "추가운동 포함 저장", count: 31, conversionFromPrevious: 0.3163 },
        ],
        rates: {
          saveFromGenerate: 0.8167,
          extraFromSaved: 0.3163,
          generatedPerDay: 1.3,
          savedPerDay: 1.1,
        },
        dropoff: {
          fromStepId: "generated_sessions",
          toStepId: "saved_logs",
          dropCount: 22,
          dropRate: 0.1833,
        },
        previous: {
          totals: {
            generatedSessions: 110,
            savedLogs: 85,
            savedLogsWithGeneratedSession: 80,
            savedLogsWithExtraExercise: 24,
            totalSets: 1190,
            extraSets: 102,
            avgSetsPerLog: 14,
          },
          rates: {
            saveFromGenerate: 0.7727,
            extraFromSaved: 0.2823,
            generatedPerDay: 1.2,
            savedPerDay: 0.95,
          },
        },
        trend: {
          generatedSessionsDelta: 10,
          savedLogsDelta: 13,
          saveFromGenerateDelta: 0.044,
          extraFromSavedDelta: 0.034,
        },
      },
      windows: [
        {
          days: 1,
          payload: {
            from: "2026-03-04",
            to: "2026-03-04",
            rangeDays: 1,
            totalEvents: 90,
            summary: {
              opens: 24,
              modeChanges: 5,
              generateClicks: 20,
              generateSuccesses: 18,
              addSheetOpens: 7,
              addExerciseAdds: 5,
              saveClicks: 16,
              saveSuccesses: 15,
              saveFailures: 1,
              repeatClicks: 3,
              repeatSuccesses: 3,
            },
            rates: {
              saveSuccessFromClicks: 0.9375,
              generateSuccessFromClicks: 0.9,
              addAfterSheetOpen: 0.7143,
              repeatSuccessFromClicks: 1,
              saveSuccessFromOpens: 0.625,
            },
          },
        },
        {
          days: 7,
          payload: {
            from: "2026-02-27",
            to: "2026-03-04",
            rangeDays: 7,
            totalEvents: 520,
            summary: {
              opens: 132,
              modeChanges: 26,
              generateClicks: 106,
              generateSuccesses: 94,
              addSheetOpens: 45,
              addExerciseAdds: 28,
              saveClicks: 90,
              saveSuccesses: 78,
              saveFailures: 7,
              repeatClicks: 15,
              repeatSuccesses: 14,
            },
            rates: {
              saveSuccessFromClicks: 0.8667,
              generateSuccessFromClicks: 0.8868,
              addAfterSheetOpen: 0.6222,
              repeatSuccessFromClicks: 0.9333,
              saveSuccessFromOpens: 0.5909,
            },
            previous: {
              totalEvents: 498,
              summary: {
                opens: 125,
                modeChanges: 24,
                generateClicks: 99,
                generateSuccesses: 86,
                addSheetOpens: 41,
                addExerciseAdds: 23,
                saveClicks: 84,
                saveSuccesses: 71,
                saveFailures: 8,
                repeatClicks: 13,
                repeatSuccesses: 12,
              },
              rates: {
                saveSuccessFromClicks: 0.8452,
                generateSuccessFromClicks: 0.8687,
                addAfterSheetOpen: 0.561,
                repeatSuccessFromClicks: 0.9231,
                saveSuccessFromOpens: 0.568,
              },
            },
            trend: {
              totalEventsDelta: 22,
              opensDelta: 7,
              modeChangesDelta: 2,
              generateSuccessesDelta: 8,
              saveSuccessesDelta: 7,
              addExerciseAddsDelta: 5,
              saveSuccessFromClicksDelta: 0.0215,
              saveSuccessFromOpensDelta: 0.0229,
            },
          },
        },
        {
          days: 14,
          payload: {
            from: "2026-02-20",
            to: "2026-03-04",
            rangeDays: 14,
            totalEvents: 980,
            summary: {
              opens: 248,
              modeChanges: 45,
              generateClicks: 197,
              generateSuccesses: 174,
              addSheetOpens: 84,
              addExerciseAdds: 56,
              saveClicks: 170,
              saveSuccesses: 146,
              saveFailures: 13,
              repeatClicks: 25,
              repeatSuccesses: 23,
            },
            rates: {
              saveSuccessFromClicks: 0.8588,
              generateSuccessFromClicks: 0.8832,
              addAfterSheetOpen: 0.6667,
              repeatSuccessFromClicks: 0.92,
              saveSuccessFromOpens: 0.5887,
            },
          },
        },
      ],
      thresholds: [
        {
          id: "saveFromGenerate",
          label: "생성→저장",
          value: 0.8167,
          target: 0.65,
          status: "ok",
          hint: "기준 충족",
        },
      ],
    },
  },
  {
    id: "stats.migrationTelemetry",
    method: "GET",
    path: "/api/stats/migration-telemetry",
    body: {
      ts: "2026-03-04T10:05:00.000Z",
      status: "ok",
      reasons: [],
      filters: {
        lookbackMinutes: 720,
        limit: 20,
        runStatus: "ALL",
        format: "json",
      },
      checks: {
        migrations: {
          localCount: 14,
          appliedCount: 14,
          pending: 0,
          latestAppliedAt: "2026-03-04T08:00:00.000Z",
          latestAppliedHash: "ab12cd34ef56",
        },
        telemetry: {
          available: true,
          lookbackMinutes: 720,
          alerts: {
            lockTimeoutCount: 0,
            failedCount: 0,
            skippedCount: 0,
            latestFailureAt: null,
            avgLockWaitMs: 11,
            maxLockWaitMs: 38,
          },
          recentRuns: [
            {
              runId: "run-1",
              runner: "deploy-job",
              host: "ci",
              status: "SUCCESS",
              errorCode: null,
              message: null,
              startedAt: "2026-03-04T09:59:00.000Z",
              finishedAt: "2026-03-04T09:59:08.000Z",
              lockWaitMs: 12,
            },
          ],
        },
      },
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

    const emptyStateLabel = page.getByText("설정 값 없음", { exact: true });
    await assertNeverVisibleDuring(emptyStateLabel, 760);

    await expect(page.getByText("플랜 카드", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mock Plan" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Error state" })).toHaveCount(0);
    await expect(emptyStateLabel).toBeHidden();

    apiMocks.assertHit("settings.snapshot");
    apiMocks.assertHit("templates.list");
    apiMocks.assertHit("plans.list");
  });

  test("templates/manage keeps list/editor empty state hidden until delayed data resolves", async ({ page }) => {
    const apiMocks = await installApiMocks(page, [...commonEndpoints, ...templatesManageEndpoints]);

    await page.goto("/templates/manage", { waitUntil: "domcontentloaded" });

    const emptyStateLabel = page.getByText("설정 값 없음", { exact: true });
    await assertNeverVisibleDuring(emptyStateLabel, 760);

    await expect(page.getByRole("button", { name: /Public Template/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /내 개인 템플릿 1/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Error state" })).toHaveCount(0);
    await expect(emptyStateLabel).toBeHidden();

    apiMocks.assertHit("settings.snapshot");
    apiMocks.assertHit("templates.list");
    apiMocks.assertHit("templates.versions");
  });

  test("stats/dashboard keeps analytic empty states hidden while delayed queries are in flight", async ({ page }) => {
    const apiMocks = await installApiMocks(page, [...commonEndpoints, ...statsDashboardEndpoints]);

    await page.goto("/stats/dashboard", { waitUntil: "domcontentloaded" });

    const emptyStateLabel = page.getByText("설정 값 없음", { exact: true });
    await assertNeverVisibleDuring(emptyStateLabel, 820);

    await expect(page.getByText("기본 흐름", { exact: true })).toBeVisible();
    await expect(page.getByText(/195(\.0)?\s*kg/)).toBeVisible();
    await expect(page.getByRole("button", { name: /플랜별 준수율 1개 플랜/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Error state" })).toHaveCount(0);
    await expect(emptyStateLabel).toBeHidden();

    apiMocks.assertHit("settings.snapshot");
    apiMocks.assertHit("plans.list");
    apiMocks.assertHit("stats.e1rm");
    apiMocks.assertHit("stats.volume");
    apiMocks.assertHit("stats.compliance");
    apiMocks.assertHit("stats.uxSnapshot");
    apiMocks.assertHit("stats.migrationTelemetry");
  });
});
