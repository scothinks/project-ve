import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const authCredential = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const runId = randomUUID().slice(0, 8);
const platformAdminEmail = `e2e-platform-admin-${runId}@example.test`;
const catalogManagerEmail = `e2e-catalog-manager-${runId}@example.test`;
const organizationOwnerEmail = `e2e-organization-owner-${runId}@example.test`;
const organizationName = `E2E Release Organisation ${runId}`;
const organizationSlug = `e2e-release-organisation-${runId}`;

let supabase: SupabaseClient;
let platformAdmin: User;
let catalogManager: User;
let organizationOwner: User;
let organizationId = "";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for admin workspace release E2E tests.`);
  }

  return value;
}

async function assertNoError<T>(
  result: { data: T | null; error: null } | { data: T | null; error: Error },
  context: string,
) {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }

  return result.data as T;
}

async function createTestUser(email: string, displayName: string) {
  const result = await supabase.auth.admin.createUser({
    email,
    password: authCredential,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (result.error || !result.data.user) {
    throw new Error(result.error?.message ?? `Could not create ${email}.`);
  }

  return result.data.user;
}

async function signIn(page: Page, email: string, nextPath = "/admin") {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  if (await page.getByPlaceholder("Enter Full Name").isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Login" }).last().click();
  }
  await page.getByPlaceholder("Enter Email Address").fill(email);
  await page.getByPlaceholder("Enter Password").fill(authCredential);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(new RegExp(`${nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), {
    timeout: 30_000,
  });
}

async function cleanupFixture() {
  const userIds = [platformAdmin, catalogManager, organizationOwner]
    .filter(Boolean)
    .map((user) => user.id);

  if (userIds.length > 0) {
    await supabase.from("platform_catalog_invitations").delete().in("invited_user_id", userIds);
    await supabase.from("platform_catalog_memberships").delete().in("user_id", userIds);
    await supabase.from("organization_memberships").delete().in("user_id", userIds);
  }

  if (organizationId) {
    await supabase.from("organization_plan_assignments").delete().eq("organization_id", organizationId);
    await supabase.from("organizations").delete().eq("id", organizationId);
  } else {
    await supabase.from("organizations").delete().eq("slug", organizationSlug);
  }

  for (const user of [platformAdmin, catalogManager, organizationOwner].filter(Boolean)) {
    await supabase.auth.admin.deleteUser(user.id);
  }
}

async function seedFixture() {
  platformAdmin = await createTestUser(platformAdminEmail, `Platform Admin ${runId}`);
  catalogManager = await createTestUser(catalogManagerEmail, `Catalog Manager ${runId}`);
  organizationOwner = await createTestUser(organizationOwnerEmail, `Organization Owner ${runId}`);

  await assertNoError(
    await supabase.from("profiles").update({ role: "admin" }).eq("id", platformAdmin.id),
    "promote platform administrator",
  );

  const organization = await assertNoError<{ id: string }>(
    await supabase
      .from("organizations")
      .insert({
        created_by: organizationOwner.id,
        name: organizationName,
        slug: organizationSlug,
        status: "published",
      })
      .select("id")
      .single(),
    "create release organization",
  );
  organizationId = organization.id;

  await assertNoError(
    await supabase.from("organization_plan_assignments").insert({
      assigned_by: platformAdmin.id,
      billing_status: "trial",
      organization_id: organizationId,
      plan_key: "team",
    }),
    "assign organization plan",
  );

  await assertNoError(
    await supabase.from("organization_memberships").insert({
      invited_by: platformAdmin.id,
      organization_id: organizationId,
      role: "organisation_owner",
      status: "active",
      user_id: organizationOwner.id,
    }),
    "seed organization owner",
  );

  await assertNoError(
    await supabase.from("platform_catalog_memberships").insert({
      invited_by: platformAdmin.id,
      role: "organisation_owner",
      status: "active",
      user_id: catalogManager.id,
    }),
    "seed platform catalog manager",
  );
}

test.describe.serial("Phase 1 admin workspace release coverage", () => {
  test.beforeAll(async () => {
    supabase = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    await cleanupFixture();
    await seedFixture();
  });

  test.afterAll(async () => {
    await cleanupFixture();
  });

  test("renders the redesigned platform attention dashboard", async ({ page }) => {
    await signIn(page, platformAdminEmail);

    await expect(
      page.getByRole("heading", { level: 1, name: "Platform Attention Dashboard" }),
    ).toBeVisible();
    await expect(page.getByText("Here’s what needs your attention across the platform ecosystem today.")).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByText("Operational Queues")).toBeVisible();
  });

  test("keeps organization administration scoped to its People workspace", async ({ page }) => {
    await signIn(page, organizationOwnerEmail);

    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByText(`Manage ${organizationName}’s operational health and ongoing activities.`)).toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Catalog Staff" })).toHaveCount(0);

    await page.getByRole("link", { name: "People" }).click();
    await expect(page).toHaveURL(/\/admin\/people$/);
    await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Members" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Invitations" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Units" })).toBeVisible();
    await expect(page.getByText(`Organization Owner ${runId}`)).toBeVisible();
  });

  test("gives catalog managers the dedicated Catalog Staff workflow", async ({ page }) => {
    await signIn(page, catalogManagerEmail);

    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByText(/Project VE’s own platform catalogue/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Catalog Staff" })).toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Reward Campaigns" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/admin\/xp-settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "XP settings" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Platform Points presentation" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Issuance and exposure controls" })).toBeVisible();

    await page.getByRole("link", { name: "Catalog Staff" }).click();
    await expect(page).toHaveURL(/\/admin\/catalog-people$/);
    await expect(page.getByRole("heading", { level: 1, name: "Catalog Staff" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Members" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Invitations" })).toBeVisible();
    await expect(page.getByText(`Catalog Manager ${runId}`)).toBeVisible();
  });
});
