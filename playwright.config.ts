import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3100", 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const localE2E = process.env.PROJECT_VE_LOCAL_E2E === "1";
const reuseExistingServer =
  !process.env.CI && !localE2E;
const buildCommand = localE2E
  ? "node scripts/clean-next-build.mjs && npm run build"
  : "npm run build";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  workers: localE2E ? 1 : undefined,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL,
    launchOptions: {
      timeout: localE2E ? 300_000 : 180_000,
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `${buildCommand} && npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer,
    timeout: localE2E ? 900_000 : 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
