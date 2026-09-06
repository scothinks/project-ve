import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

function value<T extends { data: unknown; error: { message: string } | null }>(result: T): NonNullable<T["data"]> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T["data"]>;
}

test("editor publishes saved drafts, reverts changes and rejects stale tabs", async ({ page, context }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const editor = createClient(url, key, { auth: { persistSession: false } });
  const reader = createClient(url, key, { auth: { persistSession: false } });
  const suffix = randomUUID();
  const email = `lesson-browser-${suffix}@example.test`;
  const password = randomUUID() + randomUUID();
  const courseId = `course-browser-${suffix}`;
  const lessonId = `lesson-browser-${suffix}`;
  const user = value(await service.auth.admin.createUser({ email, password, email_confirm: true })).user!;
  const path = `/admin/courses/lessons/${lessonId}`;
  const publishedTitle = async () => value(await reader.from("learner_lessons").select("published_snapshot").eq("id", lessonId).single()).published_snapshot.pages[0].title;
  const openSettings = async (tab: Page) => {
    if (!(await tab.getByLabel("Page title", { exact: true }).isVisible())) {
      await tab.getByRole("button", { name: "Edit page settings", exact: true }).click();
    }
  };
  const saveTitle = async (tab: Page, title: string, expectedStatus = 200) => {
    await openSettings(tab);
    const response = tab.waitForResponse((r) => r.url().endsWith("/api/admin/learning/builder") && r.request().method() === "POST");
    await tab.getByLabel("Page title", { exact: true }).fill(title);
    await tab.getByRole("button", { name: "Save", exact: true }).click();
    expect((await response).status()).toBe(expectedStatus);
  };
  try {
    value(await service.from("profiles").update({ role: "admin" }).eq("id", user.id));
    value(await editor.auth.signInWithPassword({ email, password }));
    value(await service.from("courses").insert({ id: courseId, slug: courseId, title: "Browser publication", description: "Test", category: "Values", status: "published" }));
    value(await service.from("lessons").insert({ id: lessonId, course_id: courseId, slug: lessonId, title: "Published lesson", status: "draft", estimated_minutes: 5 }));
    const saved = value(await editor.rpc("admin_save_lesson_builder", {
      p_lesson_id: lessonId, p_expected_revision: 0,
      p_pages: [{ id: "draft-browser-page", page_number: 1, title: "Original page", subtitle: null, page_type: "concept", cover_image: {} }],
      p_blocks: [{ id: "draft-browser-block", page_id: "draft-browser-page", block_type: "text", sort_order: 1, payload: { body: "Original content" } }],
    }));
    value(await editor.rpc("admin_publish_lesson_checked", { p_lesson_id: lessonId, p_expected_revision: saved.draftRevision }));
    await page.goto(`/login?next=${encodeURIComponent(path)}`);
    if (await page.getByPlaceholder("Enter Full Name").isVisible()) await page.getByRole("button", { name: "Login" }).last().click();
    await page.getByPlaceholder("Enter Email Address").fill(email);
    await page.getByPlaceholder("Enter Password").fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${lessonId}$`), { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Publish changes", exact: true })).toBeDisabled();

    await saveTitle(page, "New published page");
    expect(await publishedTitle()).toBe("Original page");
    const publishResponse = page.waitForResponse((r) => r.url().endsWith("/publish-lesson"));
    await page.getByRole("button", { name: "Publish changes", exact: true }).click();
    expect((await publishResponse).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Publish changes", exact: true })).toBeDisabled();
    expect(await publishedTitle()).toBe("New published page");

    await saveTitle(page, "Discard this draft");
    await page.getByRole("button", { name: "More lesson actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "Revert to published", exact: true }).click();
    const revertResponse = page.waitForResponse((r) => r.url().endsWith("/revert-lesson"));
    await page.getByRole("alertdialog").getByRole("button", { name: "Revert to published", exact: true }).click();
    expect((await revertResponse).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Publish changes", exact: true })).toBeDisabled();
    await openSettings(page);
    await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("New published page");

    // Metadata-only drift must also enable publication.
    value(await service.from("lessons").update({ title: "Edited lesson metadata" }).eq("id", lessonId));
    await page.reload();
    await expect(page.getByRole("button", { name: "Publish changes", exact: true })).toBeEnabled();
    const secondTab = await context.newPage();
    await secondTab.goto(path);
    await saveTitle(page, "Winning edit");
    await saveTitle(secondTab, "Stale edit", 409);
    await expect(secondTab.getByText("This lesson changed in another session. Reload before saving, publishing or reverting.", { exact: true }).first()).toBeVisible();
    expect(value(await editor.from("lesson_pages").select("title").eq("lesson_id", lessonId).single()).title).toBe("Winning edit");
    expect(await publishedTitle()).toBe("New published page");
    await secondTab.close();
  } finally {
    await service.from("courses").delete().eq("id", courseId);
    await service.auth.admin.deleteUser(user.id);
  }
});
