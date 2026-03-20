import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const fallbackDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/workout_log_ci";
const serverMode = process.env.PLAYWRIGHT_SERVER_MODE === "prod" ? "prod" : "dev";
const serverCommand =
  serverMode === "prod"
    ? `pnpm build && pnpm start -H 127.0.0.1 -p ${port}`
    : `pnpm exec next dev --webpack -H 127.0.0.1 -p ${port}`;
const defaultServerTimeoutMs = serverMode === "prod" ? 600_000 : 180_000;
const configuredServerTimeoutMs = Number(process.env.PLAYWRIGHT_WEB_SERVER_TIMEOUT ?? defaultServerTimeoutMs);
const webServerTimeoutMs =
  Number.isFinite(configuredServerTimeoutMs) && configuredServerTimeoutMs > 0
    ? configuredServerTimeoutMs
    : defaultServerTimeoutMs;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    headless: true,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: serverCommand,
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
          NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
        },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: webServerTimeoutMs,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
