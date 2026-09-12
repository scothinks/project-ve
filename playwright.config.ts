import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3100", 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const localE2E = process.env.PROJECT_VE_LOCAL_E2E === "1";
const developmentServer = localE2E && process.env.PROJECT_VE_E2E_DEV === "1";
// Qualification can reuse only a sealed, unchanged local production build.
const sealedThemeBuild = localE2E && Boolean(process.env.THEME_CANDIDATE_MANIFEST);
const reuseExistingServer =
  !process.env.CI && !localE2E;
// Keep the isolated production cache for iterative local regressions when
// explicitly requested. Next still builds and validates all changed inputs.
const buildCommand = localE2E && process.env.PROJECT_VE_E2E_KEEP_BUILD_CACHE !== "1"
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
    command: developmentServer
      ? `node scripts/clean-next-build.mjs && npm run dev -- -p ${port}`
      : sealedThemeBuild
        ? `node scripts/theme-candidate.mjs prepare && npm run start -- -p ${port}`
        : `${buildCommand} && npm run start -- -p ${port}`,
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
