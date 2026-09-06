import { test, expect } from "@playwright/test";
import { checked, mediaFixture } from "../support/media-browser";

// Local isolated routes may need a cold compilation before returning.
test.use({ actionTimeout: 60_000 });
test.describe.configure({ timeout: 300_000 });

test("page generation retains candidates, recovers navigation and saves once", async ({ browser, baseURL }, info) => {
  test.setTimeout(300_000);
  const f = await mediaFixture(browser, baseURL!);
  const page = await f.context.newPage();
  page.setDefaultTimeout(60_000);
  const operations: string[] = [];
  let claim: { id: string; lock_token: string; lock_version: number } | undefined;
  try {
    const target = await f.lesson([{ block_type: "text", payload: { body: "Existing lesson content." } }]);
    // Replace only dispatch/provider execution. Real authenticated quote/start,
    // fenced checkpoints, status reads and atomic application all hit local DB.
    await page.route("**/api/admin/ai/authoring", async route => {
      if (route.request().method() !== "POST" || route.request().postDataJSON().action !== "start") return route.continue();
      const id = route.request().postDataJSON().id;
      operations.push(id);
      const result = checked(await f.editor.rpc("admin_start_ai_page", { p_id: id }));
      claim = checked(await f.service.rpc("service_claim_ai_page", { p_id: id, p_worker: "browser-fixture" }))[0];
      checked(await f.service.rpc("service_ai_page_checkpoint", { p_job: claim!.id, p_worker: "browser-fixture", p_token: claim!.lock_token, p_version: claim!.lock_version, p_action: "begin" }));
      await route.fulfill({ json: result });
    });
    let connectionLost = true;
    await page.route("**/api/admin/ai/authoring/events?**", route => route.abort());
    await page.route("**/api/admin/ai/authoring?id=**", route => connectionLost
      ? route.fulfill({ status: 503, json: { error: "Connection interrupted" } }) : route.continue());
    await page.goto(`${baseURL}/admin/courses/lessons/${target.lesson}`);
    await page.getByRole("button", { name: "Edit page settings", exact: true }).click();
    await page.getByLabel("Page title", { exact: true }).fill("Saved before generation");
    await page.getByRole("button", { name: "Suggest next page", exact: true }).click();
    let drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("button", { name: "Suggest next page", exact: true })).toBeEnabled({ timeout: 30_000 });
    await expect(drawer.getByRole("combobox")).toHaveCount(0);
    await expect(drawer.getByRole("textbox")).not.toBeVisible();
    expect(operations).toHaveLength(0);
    await page.screenshot({ path: info.outputPath("assistant-cost.png"), animations: "disabled" });
    expect(checked(await f.editor.from("lesson_pages").select("title").eq("lesson_id", target.lesson).single()).title).toBe("Saved before generation");
    await drawer.getByRole("button", { name: "Suggest next page", exact: true }).click();
    await expect(drawer.getByText("Reconnecting to your saved result.", { exact: false })).toBeVisible({ timeout: 30_000 });
    connectionLost = false;
    await expect(drawer.getByText("Considering what would help next", { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(operations).toHaveLength(1);
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    expect(checked(await f.editor.rpc("admin_read_ai_results", { p_id: operations[0] })).stopRequested).toBe(false);
    checked(await f.service.rpc("service_ai_page_checkpoint", { p_job: claim!.id, p_worker: "browser-fixture", p_token: claim!.lock_token, p_version: claim!.lock_version,
      p_action: "ready", p_candidate: { decision: "page", reason: "A practical example will help learners apply the idea before moving on.", position: 1, title: "Working together", subtitle: "A practical idea", pageType: "concept", blocks: [
        { blockType: "text", payload: { heading: "Listen first", body: "Listen to each person before choosing what to do." } },
        { blockType: "image", payload: { mediaIntent: { version: 1, kind: "image", purpose: "A diagram showing how everyone contributes", aspectRatio: "16:9", required: false, style: "inherit" } } },
        { blockType: "callout", payload: { variant: "key_point", title: "Remember", body: "Everyone can contribute." } },
      ] } }));
    await page.goto(`${baseURL}/admin/courses`);
    await page.getByRole("button", { name: /^AI results/ }).click();
    drawer = page.getByRole("dialog");
    await drawer.locator(`button[data-result-id="${operations[0]}"]`).click();
    await expect(drawer.getByRole("heading", { name: "Working together" })).toBeVisible({ timeout: 30_000 });
    // A failed background list read must not obscure a recovered result.
    await page.route("**/api/admin/ai/authoring?offset=**", route => route.fulfill({ status: 503, json: { error: "List temporarily unavailable" } }));
    await drawer.getByRole("link", { name: "Review in lesson" }).click();
    await expect(page).toHaveURL(new RegExp(`aiResult=${operations[0]}`));
    await expect(drawer.getByRole("button", { name: "Add page", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(drawer.getByRole("alert")).toHaveCount(0);
    await expect(drawer.getByText(/image placeholder.*optional/i)).toBeVisible();
    await expect(drawer.getByText("Why this page helps", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Suggested placement: page 1", { exact: true })).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: info.outputPath(`ai-page-result-${width}.png`) });
      expect(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await drawer.getByRole("button", { name: "Add page", exact: true }).click();
    await expect(drawer.getByRole("link", { name: "Open saved page" })).toBeVisible({ timeout: 30_000 });
    const receipt = checked(await f.editor.rpc("admin_apply_ai_page", { p_id: operations[0] }));
    expect(receipt.status).toBe("saved");
    expect(receipt.page.page_number).toBe(1);
    expect(checked(await f.editor.from("lesson_pages").select("id").eq("lesson_id", target.lesson))).toHaveLength(2);
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByPlaceholder("Caption (optional)", { exact: true }).fill("Shared responsibility");
    await expect.poll(async () => {
      const rows = checked(await f.editor.from("lesson_content_blocks").select("payload").eq("page_id", receipt.pageId));
      return rows.find(row => row.payload.mediaIntent)?.payload.caption;
    }, { timeout: 30_000 }).toBe("Shared responsibility");
    expect(checked(await f.editor.from("lesson_content_blocks").select("payload").eq("page_id", receipt.pageId)).find(row => row.payload.mediaIntent)?.payload.mediaIntent.purpose).toBe("A diagram showing how everyone contributes");
    await page.getByRole("button", { name: "Add an image", exact: true }).click();
    await drawer.getByRole("button", { name: "Generate with AI", exact: true }).click();
    const brief = drawer.getByRole("textbox", { name: "Image brief", exact: true });
    for (const text of ["A diagram showing how everyone contributes", "Media release lesson", "Working together", "Listen to each person"]) {
      await expect(brief).toHaveValue(new RegExp(text));
    }
    await page.screenshot({ path: info.outputPath("media-brief-390.png"), animations: "disabled" });
    expect(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const editedBrief = "Show neighbours listening to each other. Use documentary photography and natural colours.";
    await brief.fill(editedBrief);
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Add an image", exact: true }).click();
    await drawer.getByRole("button", { name: "Generate with AI", exact: true }).click();
    await expect(brief).toHaveValue(editedBrief);
    await expect.poll(async () => {
      const rows = checked(await f.editor.from("lesson_content_blocks").select("payload").eq("page_id", receipt.pageId));
      return rows.find(row => row.payload.mediaIntent)?.payload.mediaBrief;
    }, { timeout: 30_000 }).toBe(editedBrief);
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(drawer.getByRole("link", { name: "Open saved page" })).toBeVisible({ timeout: 30_000 });
    await page.goto(`${baseURL}/admin/courses/lessons/${target.lesson}?page=${receipt.pageId}`);
    await page.getByRole("button", { name: "Add an image", exact: true }).click();
    await drawer.getByRole("button", { name: "Generate with AI", exact: true }).click();
    await expect(brief).toHaveValue(editedBrief);
    expect(operations).toHaveLength(1);
    expect(checked(await f.editor.rpc("admin_read_ai_results", { p_id: operations[0] })).credit.status).toBe("unmetered");
  } finally {
    for (const id of operations) await f.editor.rpc("admin_delete_ai_result", { p_id: id });
    await f.cleanup();
  }
});

test("ready results recover a lost save response and retain failed refinements", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const f = await mediaFixture(browser, baseURL!);
  const page = await f.context.newPage();
  page.setDefaultTimeout(60_000);
  const ids: string[] = [];
  try {
    const target = await f.lesson([{ block_type: "text", payload: { body: "A lesson to extend." } }]);
    const revision = checked(await f.editor.from("lessons").select("draft_revision").eq("id", target.lesson).single()).draft_revision;
    const quoted = checked(await f.editor.rpc("admin_quote_ai_page", { p_lesson_id: target.lesson, p_revision: revision,
      p_focus: "A helpful example", p_page_type: "scenario", p_position: 2 }));
    ids.push(quoted.id);
    checked(await f.editor.rpc("admin_start_ai_page", { p_id: quoted.id }));
    const claim = checked(await f.service.rpc("service_claim_ai_page", { p_id: quoted.id, p_worker: "recovery-fixture" }))[0];
    const lease = { p_job: claim.id, p_worker: "recovery-fixture", p_token: claim.lock_token, p_version: claim.lock_version };
    checked(await f.service.rpc("service_ai_page_checkpoint", { ...lease, p_action: "begin" }));
    checked(await f.service.rpc("service_ai_page_checkpoint", { ...lease, p_action: "ready", p_candidate: {
      title: "A helpful example", subtitle: "Keep going", pageType: "scenario", blocks: [{ blockType: "text", payload: { body: "Try a small helpful action." } }],
    } }));
    await page.goto(`${baseURL}/admin/courses/lessons/${target.lesson}?aiResult=${quoted.id}`);
    const drawer = page.getByRole("dialog");
    let loseResponse = true;
    await page.route("**/api/admin/ai/authoring", async route => {
      const body = route.request().postDataJSON();
      if (body.action === "apply" && loseResponse) {
        loseResponse = false;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort("failed");
      } else if (body.action === "start") {
        ids.push(body.id);
        const started = checked(await f.editor.rpc("admin_start_ai_page", { p_id: body.id }));
        const retry = checked(await f.service.rpc("service_claim_ai_page", { p_id: body.id, p_worker: "recovery-fixture" }))[0];
        const retryLease = { p_job: retry.id, p_worker: "recovery-fixture", p_token: retry.lock_token, p_version: retry.lock_version };
        checked(await f.service.rpc("service_ai_page_checkpoint", { ...retryLease, p_action: "begin" }));
        checked(await f.service.rpc("service_ai_page_checkpoint", { ...retryLease, p_action: "failed" }));
        await route.fulfill({ json: started });
      } else await route.continue();
    });
    await drawer.getByRole("button", { name: "Add page", exact: true }).click();
    await expect.poll(async () => checked(await f.editor.rpc("admin_read_ai_results", { p_id: quoted.id })).applicationState, { timeout: 30_000 }).toBe("saved");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(drawer.getByRole("link", { name: "Open saved page" })).toBeVisible({ timeout: 30_000 });
    expect(checked(await f.editor.from("lesson_pages").select("id").eq("lesson_id", target.lesson))).toHaveLength(2);
    await drawer.getByRole("button", { name: "Create another version" }).click();
    await expect(drawer.getByRole("button", { name: "Create another version", exact: true })).toBeEnabled();
    await drawer.getByLabel("What would you like to change?").fill("Use a school example");
    await drawer.getByRole("button", { name: "Check cost" }).click();
    await drawer.getByRole("button", { name: "Create another version", exact: true }).click();
    await expect(drawer.getByText("Needs attention", { exact: true })).toBeVisible({ timeout: 30_000 });
    await drawer.getByRole("button", { name: "All results", exact: true }).click();
    await drawer.locator(`button[data-result-id="${ids[0]}"]`).click();
    await expect(drawer.getByRole("heading", { name: "A helpful example", exact: true })).toBeVisible({ timeout: 30_000 });
    expect(checked(await f.editor.rpc("admin_read_ai_results", { p_id: quoted.id })).candidate.title).toBe("A helpful example");
  } finally {
    for (const id of ids) await f.editor.rpc("admin_delete_ai_result", { p_id: id });
    await f.cleanup();
  }
});

test("assistant can suggest reviewing the quiz without adding a page", async ({ browser, baseURL }, info) => {
  const f = await mediaFixture(browser, baseURL!);
  const page = await f.context.newPage();
  let resultId: string | undefined;
  try {
    const target = await f.lesson([{ block_type: "text", payload: { heading: "Listening", body: "Listen to each person. For example, ask neighbours about a shared concern before deciding together." } }]);
    await page.route("**/api/admin/ai/authoring", async route => {
      if (route.request().method() !== "POST" || route.request().postDataJSON().action !== "start") return route.continue();
      resultId = route.request().postDataJSON().id;
      const started = checked(await f.editor.rpc("admin_start_ai_page", { p_id: resultId! }));
      expect(started.assistant).toBe(true);
      const claim = checked(await f.service.rpc("service_claim_ai_page", { p_id: resultId!, p_worker: "complete-fixture" }))[0];
      const lease = { p_job: claim.id, p_worker: "complete-fixture", p_token: claim.lock_token!, p_version: claim.lock_version };
      const context = checked(await f.service.rpc("service_ai_page_checkpoint", { ...lease, p_action: "begin" }));
      expect(context.existingPages[0].content).toContain("ask neighbours");
      checked(await f.service.rpc("service_ai_page_checkpoint", { ...lease, p_action: "ready", p_candidate: {
        decision: "review_quiz", reason: "The lesson explains listening and includes a practical example. Review how the quiz checks that understanding.",
        position: 1, title: "Review the quiz", subtitle: "", pageType: "concept", blocks: [],
      } }));
      await route.fulfill({ json: started });
    });
    await page.goto(`${baseURL}/admin/courses/lessons/${target.lesson}`);
    await page.getByRole("button", { name: "Suggest next page", exact: true }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("button", { name: "Suggest next page", exact: true })).toBeEnabled({ timeout: 30_000 });
    await drawer.getByRole("button", { name: "Suggest next page", exact: true }).click();
    await expect(drawer.getByRole("link", { name: "Review quiz", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(drawer.getByRole("button", { name: "Add page", exact: true })).toHaveCount(0);
    expect(checked(await f.editor.from("lesson_pages").select("id").eq("lesson_id", target.lesson))).toHaveLength(1);
    expect((await f.editor.rpc("admin_apply_ai_page", { p_id: resultId! })).error?.code).toBe("PT409");
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: info.outputPath("assistant-review-quiz-390.png"), animations: "disabled" });
    expect(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^AI results/ }).click();
    await drawer.locator(`button[data-result-id="${resultId}"]`).click();
    await drawer.getByRole("link", { name: "Review quiz", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${target.lesson}/quiz`));
  } finally {
    if (resultId) await f.editor.rpc("admin_delete_ai_result", { p_id: resultId });
    await f.cleanup();
  }
});
