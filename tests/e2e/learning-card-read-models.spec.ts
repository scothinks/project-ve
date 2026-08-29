import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const credential = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const runId = randomUUID().slice(0, 8);
const learnerEmail = `e2e-learning-cards-${runId}@example.test`;

let learner: User;
let supabase: SupabaseClient;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for learning card E2E tests.`);
  return value;
}

async function signIn(page: Page, nextPath: string) {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByPlaceholder("Enter Email Address").fill(learnerEmail);
  await page.getByPlaceholder("Enter Password").fill(credential);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(new RegExp(`${nextPath}$`), { timeout: 30_000 });
}

async function gotoMeasured(page: Page, label: string, path: string) {
  const startedAt = performance.now();
  await page.goto(path);
  if (process.env.PERF_LOGS === "1") {
    console.info(`[perf] ${label} ${Math.round(performance.now() - startedAt)}ms`);
  }
}

async function gotoMeasuredDashboard(page: Page, temperature: "cold" | "warm") {
  const startedAt = performance.now();
  await page.goto("/dashboard", { waitUntil: "commit" });
  await expect(page.locator('[data-dashboard-core="continue-learning"]')).toBeVisible();
  const firstUsefulHtmlMs = Math.round(performance.now() - startedAt);
  await expect(page.locator('[data-dashboard-secondary="editorial-recommendations"]')).toBeVisible();
  const secondaryHtmlMs = Math.round(performance.now() - startedAt);

  if (process.env.PERF_LOGS === "1") {
    console.info(`[perf] dashboard.first_useful_html.${temperature} ${firstUsefulHtmlMs}ms`);
    console.info(`[perf] dashboard.secondary_html.${temperature} ${secondaryHtmlMs}ms`);
  }
}

test.describe("screen-specific learning card read models", () => {
  test.beforeAll(async () => {
    supabase = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const created = await supabase.auth.admin.createUser({
      email: learnerEmail,
      password: credential,
      email_confirm: true,
      user_metadata: { display_name: `Learning Cards ${runId}` },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Could not create learning card learner.");
    }
    learner = created.data.user;

    const { error } = await supabase.from("user_value_profiles").insert({
      user_id: learner.id,
      context_scope: "platform",
      organization_id: null,
      assessment_completed_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Could not mark starter assessment complete: ${error.message}`);
  });

  test.afterAll(async () => {
    if (learner?.id) await supabase.auth.admin.deleteUser(learner.id);
  });

  test("Dashboard and Courses render from the shared focused card model", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page, "/profile");
    await gotoMeasuredDashboard(page, "cold");
    await expect(page.getByRole("heading", { name: "No Active Learning" })).toBeVisible();

    await gotoMeasured(page, "courses.navigation.warm", "/courses");
    await expect(page.getByRole("heading", { name: "Course Library" })).toBeVisible();
    await gotoMeasuredDashboard(page, "warm");
    await expect(page.getByRole("heading", { name: "No Active Learning" })).toBeVisible();
    await gotoMeasured(page, "courses.navigation.repeat", "/courses");
    await expect(page.getByRole("heading", { name: "Course Library" })).toBeVisible();
  });
});
