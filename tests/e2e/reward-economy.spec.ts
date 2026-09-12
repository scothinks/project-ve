import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

test.setTimeout(120_000);

const runId = randomUUID().slice(0, 8);
const email = `economy-${runId}@example.test`;
const password = randomUUID() + randomUUID();
let client: SupabaseClient;
let userId: string;
async function next(page: Page) {
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
}
async function login(page: Page) {
  await page.context().addCookies([
    {
      name: "project-ve-admin-workspace",
      value: "platform-catalog",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/login?next=/admin/economy");
  if (
    await page
      .getByLabel("Full name", { exact: true })
      .isVisible()
      .catch(() => false)
  )
    await page
      .getByRole("button", { name: "Sign in", exact: true })
      .last()
      .click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/economy$/);
  await expect(
    page.getByRole("heading", {
      name: "Reward economy",
      exact: true,
      level: 1,
    }),
  ).toBeVisible({ timeout: 30_000 });
}
test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url))
    throw new Error("Reward Economy browser fixtures require local Supabase.");
  client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const result = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Economy reviewer" },
  });
  if (result.error || !result.data.user) throw result.error;
  userId = result.data.user.id;
  const promoted = await client
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", userId);
  if (promoted.error) throw promoted.error;
});
test.afterAll(async () => {
  if (userId) await client.auth.admin.deleteUser(userId);
});
test("mission proof branch and review retain values and validate before saving", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/missions/new");
  await next(page);
  await expect(page.locator('[name="title"]')).toBeFocused();
  await page.locator('[name="title"]').fill(`Mission ${runId}`);
  await page
    .locator('textarea[name="description"]')
    .fill("Submit evidence of applying the idea.");
  await page.locator('[name="validationType"]').selectOption("proof_upload");
  await next(page);
  await page.locator('[name="rewardXp"]').fill("17");
  await next(page);
  await page.locator('[name="endsAt"]').fill("2027-10-01T12:00");
  await page.getByRole("button", { name: "No end date", exact: true }).click();
  await expect(page.locator('[name="endsAt"]')).toHaveValue("");
  await next(page);
  await expect(
    page.getByRole("heading", { name: "Proof requirements", exact: true }),
  ).toBeVisible();
  await page.locator('[name="requiresManualReview"]').check();
  await page.getByRole("button", { name: "Review →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review before saving" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Mission ${runId}`, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Mission title", exact: true }).click();
  await expect(page.locator('[name="title"]')).toHaveValue(`Mission ${runId}`);
  await page
    .locator('[name="validationType"]')
    .selectOption("lesson_count_completed");
  await expect(
    page.getByRole("button", { name: /Proof requirements/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "2. What they earn", exact: true })
    .click();
  await expect(page.locator('[name="rewardXp"]')).toHaveValue("17");
});
test("reward creation branches to a perk and retains settings through review", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/rewards/new");
  await page.locator('[name="title"]').fill(`Reward ${runId}`);
  await page
    .locator('textarea[name="description"]')
    .fill("A considered reward for learning.");
  await page.locator('[name="costXp"]').fill("25");
  await next(page);
  await page.locator('[name="distributionMode"]').selectOption("perk_bundle");
  await expect(
    page.getByText("Prize pool wrapper", { exact: true }),
  ).toBeVisible();
  await next(page);
  await page.locator('[name="terms"]').fill("Available while stock lasts.");
  await next(page);
  await expect(
    page.getByText("Fallback", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review →", exact: true }).click();
  await expect(
    page.locator("dd").filter({ hasText: /^Low-XP perk$/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "1. The reward", exact: true })
    .click();
  await expect(page.locator('[name="costXp"]')).toHaveValue("25");
});
test("perk and campaign setup keep values across all steps", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/rewards/perks/new");
  await page.locator('[name="title"]').fill(`Perk ${runId}`);
  await page
    .locator('textarea[name="description"]')
    .fill("A surprise for learning.");
  await next(page);
  await next(page);
  await next(page);
  await next(page);
  await page.getByRole("button", { name: "Review →", exact: true }).click();
  await expect(page.getByText(`Perk ${runId}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "1. The perk", exact: true }).click();
  await expect(page.locator('[name="title"]')).toHaveValue(`Perk ${runId}`);
  await page.goto("/admin/campaigns/new");
  await page.locator('[name="name"]').fill(`Campaign ${runId}`);
  await page.locator('[name="budgetLabel"]').fill("Community learning fund");
  await next(page);
  await page.getByRole("button", { name: "Review →", exact: true }).click();
  await expect(
    page.getByText("Community learning fund", { exact: true }),
  ).toBeVisible();
});
test("stock method switching retains fields and requires checked batch rows", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/inventory/new");
  const quantity = page
    .locator("form")
    .filter({ has: page.locator('[name="totalAvailable"]') });
  await quantity
    .getByRole("button", { name: "2. Quantity & dates", exact: true })
    .click();
  // A destination must be valid before advancing. Empty required rewards stay on the first step.
  if ((await quantity.locator('[name="rewardId"] option').count()) > 1) {
    await quantity.locator('[name="rewardId"]').selectOption({ index: 1 });
    await quantity
      .getByRole("button", { name: "2. Quantity & dates", exact: true })
      .click();
    await quantity.locator('[name="totalAvailable"]').fill("12");
    await page.getByRole("radio", { name: "Voucher or QR batch" }).check();
    await page.getByRole("radio", { name: "Quantity allocation" }).check();
    await expect(quantity.locator('[name="totalAvailable"]')).toHaveValue("12");
  }
  await page.getByRole("radio", { name: "Voucher or QR batch" }).check();
  await expect(
    page.getByRole("button", { name: "Add checked rows" }),
  ).toBeHidden();
  const batch = page
    .locator("form")
    .filter({ has: page.locator('[name="inventoryText"]') });
  await expect(batch.locator('[name="rewardId"] option')).not.toHaveCount(1);
  await batch.locator('[name="rewardId"]').selectOption({ index: 1 });
  await batch.getByRole("button", { name: "Continue →", exact: true }).click();
  await batch.locator('[name="batchLabel"]').fill(`Checked batch ${runId}`);
  await batch.getByRole("button", { name: "Continue →", exact: true }).click();
  const code = randomUUID();
  await batch.locator("textarea").fill(`${code}\n${code}\n${randomUUID()}`);
  await batch.getByRole("button", { name: "Review →", exact: true }).click();
  await batch.getByRole("button", { name: "Dry run", exact: true }).click();
  await expect(
    batch.getByText("Entry 2: repeats an earlier entry.", { exact: true }),
  ).toBeVisible();
  await expect(
    batch.getByRole("button", { name: "Add checked rows", exact: true }),
  ).toBeDisabled();
  await batch
    .getByRole("button", {
      name: "Keep 2 unique, new entries and check again",
      exact: true,
    })
    .click();
  await batch.getByRole("button", { name: "Dry run", exact: true }).click();
  await expect(
    batch.getByRole("button", { name: "Add 2 valid rows", exact: true }),
  ).toBeEnabled();
  await batch
    .getByRole("button", { name: "2. Batch details", exact: true })
    .click();
  await expect(batch.locator('[name="batchLabel"]')).toHaveValue(
    `Checked batch ${runId}`,
  );
  await page.goto("/admin/inventory/reallocate");
  await expect(
    page.getByRole("button", { name: "3. Reason for the move", exact: true }),
  ).toBeVisible();
});
test("economy pages render at desktop and mobile without overflow", async ({
  page,
}) => {
  await login(page);
  mkdirSync("output/playwright/reward-economy-production", { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "economy",
      "missions",
      "proofs",
      "rewards",
      "rewards/perks",
      "campaigns",
      "redemptions",
    ]) {
      await page.goto(`/admin/${route}`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByText("Application error", { exact: false }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/playwright/reward-economy-production/${route.replaceAll("/", "-")}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.goto("/admin/redemptions?view=all&campaignId=none");
  await expect(page.locator("h1")).toHaveText("Redemptions");
  await expect(
    page.getByRole("combobox", { name: "Campaign", exact: true }),
  ).toHaveValue("none");
});
