import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const authCredential = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const runId = randomUUID().slice(0, 8);
const learnerEmail = `e2e-auth-boundary-${runId}@example.test`;

let supabase: SupabaseClient;
let learner: User;

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for auth boundary E2E tests.`);
  }

  return value;
}

async function createTestUser(email: string, displayName: string) {
  const result = await supabase.auth.admin.createUser({
    email,
    password: authCredential,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  });

  if (result.error || !result.data.user) {
    throw new Error(result.error?.message ?? `Could not create ${email}.`);
  }

  return result.data.user;
}

async function signIn(page: Page, nextPath = "/courses") {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByPlaceholder("Enter Email Address").fill(learnerEmail);
  await page.getByPlaceholder("Enter Password").fill(authCredential);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(new RegExp(`${nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), {
    timeout: 30_000,
  });
}

async function expectLearnerBottomNavHidden(page: Page) {
  await expect(page.locator('nav a[href="/courses"]')).toHaveCount(0);
}

async function expectLearnerBottomNavHiddenOnDesktop(page: Page) {
  await expect(page.locator('nav a[href="/courses"]')).toBeHidden();
}

async function expectLearnerTopNavigationVisible(page: Page) {
  const learnerSections = page.getByLabel("Learner sections");

  await expect(learnerSections.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(learnerSections.getByRole("link", { name: "Lessons" })).toBeVisible();
  await expect(learnerSections.getByRole("link", { name: "Missions" })).toBeVisible();
}

async function expectLoginRedirectTo(page: Page, expectedNextPath: string) {
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByPlaceholder("Enter Email Address")).toBeVisible();
  const url = new URL(page.url());

  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("next")).toBe(expectedNextPath);
}

async function expectOrgDiscoveryPage(page: Page) {
  await expect(page).toHaveURL(/\/org$/);
  await expect(page.getByRole("heading", { name: "Orgs" }).first()).toBeVisible();
}

test.describe("public shell and authenticated learner route boundary", () => {
  test.beforeAll(async () => {
    supabase = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
    learner = await createTestUser(learnerEmail, `Auth Boundary Learner ${runId}`);
  });

  test.afterAll(async () => {
    if (learner?.id) {
      await supabase.auth.admin.deleteUser(learner.id);
    }
  });

  test("signed-out informational pages use the public shell", async ({ page }) => {
    for (const route of ["/terms", "/privacy", "/faq", "/support"]) {
      await page.context().clearCookies();
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.getByLabel("Go back")).toHaveAttribute("type", "button");
      await expectLearnerBottomNavHidden(page);
    }
  });

  test("signed-out learner destinations redirect to login with a safe next path", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/courses");
    await expectLoginRedirectTo(page, "/courses");

    await page.context().clearCookies();
    await page.goto("/lessons/hotfix-auth-lesson");
    await expectLoginRedirectTo(page, "/lessons/hotfix-auth-lesson");
  });

  test("a browser-supplied verified-auth marker cannot bypass middleware", async ({ page }) => {
    await page.context().clearCookies();
    await page.setExtraHTTPHeaders({
      "x-project-ve-auth-user-email": "spoofed@example.com",
      "x-project-ve-auth-user-id": "00000000-0000-0000-0000-000000000000",
      "x-project-ve-auth-verified": "1",
    });
    await page.goto("/courses");
    await expectLoginRedirectTo(page, "/courses");
  });

  test("protected lesson redirects preserve referral parameters for auth return", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/lessons/hotfix-auth-lesson?ref=hotfixref123&refKind=public");

    await expectLoginRedirectTo(
      page,
      "/lessons/hotfix-auth-lesson?ref=hotfixref123&refKind=public",
    );
    const url = new URL(page.url());
    expect(url.searchParams.get("ref")).toBe("hotfixref123");
    expect(url.searchParams.get("refKind")).toBe("public");
  });

  test("contextual referral-link actions require a real authenticated session", async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.request.post(
      "/api/missions/mission-referral-learner/referral-link",
      { data: { programmeId: "40404040-4040-4040-8040-404040404020" } },
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in to create a referral link." });
  });

  test("next returns an authenticated learner to protected learner routes", async ({ page }) => {
    await signIn(page, "/courses");
    await expect(page).toHaveURL(/\/courses$/);
    await expect(page.getByRole("heading", { name: "Course Library" })).toBeVisible();
    await expectLearnerTopNavigationVisible(page);
    await expectLearnerBottomNavHiddenOnDesktop(page);

    await page.goto("/missions");
    await expect(page).toHaveURL(/\/missions$/);
    await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();
  });

  test("signed-in learner still receives learner navigation on public information pages", async ({ page }) => {
    await signIn(page, "/courses");
    await expect(page).toHaveURL(/\/courses$/);

    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByLabel("Go back")).toHaveAttribute("type", "button");
    await expectLearnerTopNavigationVisible(page);
    await expectLearnerBottomNavHiddenOnDesktop(page);
  });

  test("organisation discovery, invitations and auth callbacks remain public entry routes", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/org");
    await expectOrgDiscoveryPage(page);
    await expectLearnerBottomNavHidden(page);

    await page.context().clearCookies();
    await page.goto(`/invite/hotfix-auth-boundary-${runId}`);
    await expect(page).toHaveURL(new RegExp(`/invite/hotfix-auth-boundary-${runId}$`));
    await expect(page.getByRole("heading", { name: "This invite link is not available." })).toBeVisible();

    await page.context().clearCookies();
    await page.goto("/auth/callback?next=/org");
    await expectOrgDiscoveryPage(page);
  });
});
