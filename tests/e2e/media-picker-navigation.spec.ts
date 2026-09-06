import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("media picker drawer retains the editor and reopens cleanly", async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `picker-navigation-${randomUUID()}@example.test`;
  const password = randomUUID() + randomUUID();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Could not create fixture.");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const role = await service.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    if (role.error) throw role.error;
    const cookies: { name: string; value: string }[] = [];
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: { getAll: () => [], setAll: (values) => { cookies.push(...values); } },
    });
    const signedIn = await auth.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    await page.context().addCookies(cookies.map(({ name, value }) => ({ name, value, url: baseURL!, sameSite: "Lax" })));
    await page.goto("/admin/courses/new");
    await expect(page).toHaveURL(/\/admin\/courses\/new$/, { timeout: 90_000 });
    await page.locator('input[name="title"]').fill("Unsaved course title");
    await page.getByRole("button", { name: /Add a cover image/ }).click();
    await expect(page).toHaveURL(/\/admin\/courses\/new$/);
    await expect(page.getByRole("heading", { name: "Choose a cover image" })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/courses\/new$/);
    await expect(page.locator('input[name="title"]')).toHaveValue("Unsaved course title");
    await page.getByRole("button", { name: /Add a cover image/ }).click();
    await expect(page.getByRole("heading", { name: "Choose a cover image" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Choose a cover image" })).not.toBeVisible();
    await expect(page.locator('input[name="title"]')).toHaveValue("Unsaved course title");
    expect(errors).toEqual([]);
  } finally {
    await service.auth.admin.deleteUser(data.user.id);
  }
});
