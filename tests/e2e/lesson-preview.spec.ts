import { expect as baseExpect, test } from "@playwright/test";
import { checked, mediaFixture } from "../support/media-browser";

const expect = baseExpect.configure({ timeout: 60_000 });

test("editor moves from saved pages to quiz setup and previews every layout and question type without learner writes", async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(420_000);
  const f = await mediaFixture(browser, baseURL!);
  let taggedLessonId: string | undefined;
  try {
    const parent = await f.lesson([]);
    const created = checked(await f.editor.rpc("admin_upsert_lesson", {
      p_lesson_id: "", p_course_id: parent.course, p_title: "Connected lesson workflow", p_status: "draft",
      p_description: "Preview workflow fixture", p_cover_image: {}, p_sort_order: 1, p_estimated_minutes: 5,
      p_retry_mode: "anytime", p_retry_cooldown_seconds: null, p_retry_requires_reread: false,
      p_quiz_requires_lesson_completion: true, p_max_earning_attempts: null,
    }));
    const lessonId = created.lessonId;
    taggedLessonId = lessonId;
    checked(await f.service.from("content_value_tags").delete().eq("content_type", "lesson").eq("content_id", lessonId));
    const base = `/admin/courses/lessons/${lessonId}`;
    const quiz = checked(await f.editor.from("quizzes").select("id").eq("lesson_id", lessonId).single());
    const page = await f.context.newPage();
    page.setDefaultNavigationTimeout(60_000);
    const learnerWrites: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/(quizzes|lesson-progress|xp)(\/|$|\?)/.test(request.url())) learnerWrites.push(request.url());
    });
    await page.goto(`${baseURL}${base}/preview`);
    await expect(page.getByRole("heading", { name: "No lesson pages yet" })).toBeVisible();
    await page.getByRole("link", { name: "Continue to quiz", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No quiz questions yet" })).toBeVisible();

    const types = ["primer", "concept", "example", "reflection", "summary"];
    const revision = checked(await f.editor.from("lessons").select("draft_revision").eq("id", lessonId).single()).draft_revision;
    checked(await f.editor.rpc("admin_save_lesson_builder", {
      p_lesson_id: lessonId, p_expected_revision: revision,
      p_pages: types.map((type, i) => ({ id: `draft-preview-${i}`, page_number: i + 1, title: `${type} page`, subtitle: "Clear guidance for every learner", page_type: type, cover_image: {} })),
      p_blocks: types.flatMap((_, i) => [
        { id: `draft-text-${i}`, page_id: `draft-preview-${i}`, block_type: "text", sort_order: 1, payload: { heading: "A useful idea", body: "Read the lesson, consider the example, then check your understanding in the quiz." } },
        { id: `draft-callout-${i}`, page_id: `draft-preview-${i}`, block_type: "callout", sort_order: 2, payload: { title: "Remember", body: "The quiz follows the last lesson page.", variant: "key_point" } },
      ]),
    }));
    await page.goto(`${baseURL}${base}`);
    await page.getByRole("button", { name: "Edit page settings", exact: true }).click();
    await page.getByLabel("Page title", { exact: true }).fill("Saved before quiz setup");
    await page.getByRole("button", { name: "Next: Quiz", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}${base}/quiz`);
    expect(checked(await f.editor.from("lesson_pages").select("title").eq("lesson_id", lessonId).eq("page_number", 1).single()).title).toBe("Saved before quiz setup");
    await expect(page.getByRole("navigation", { name: "Lesson authoring steps" }).locator('[aria-current="step"]')).toContainText("2. Quiz");
    await page.getByRole("button", { name: "Add question", exact: true }).click();
    await page.getByRole("button", { name: "True/false", exact: true }).click();
    await page.getByPlaceholder("Write the question").fill("The quiz follows the lesson pages.");
    await page.getByPlaceholder("Why is this the correct answer?").fill("The quiz checks what you learned.");
    await page.getByRole("button", { name: "Create question", exact: true }).click();
    await expect(page.getByRole("heading", { name: "1 questions", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create question", exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(`${baseURL}${base}/quiz`);
    expect(checked(await f.editor.from("quiz_questions").select("question_type").eq("quiz_id", quiz.id).single()).question_type).toBe("true_false");
    await page.getByPlaceholder("Write the question").fill("A saved question stays in the quiz editor.");
    await page.getByRole("button", { name: "Save question", exact: true }).click();
    await expect.poll(async () => checked(await f.editor.from("quiz_questions").select("prompt").eq("quiz_id", quiz.id).single()).prompt).toBe("A saved question stays in the quiz editor.");
    await expect(page.getByRole("button", { name: "Save question", exact: true })).toBeEnabled();
    await expect(page.getByPlaceholder("Write the question")).toHaveValue("A saved question stays in the quiz editor.");
    await expect(page).toHaveURL(`${baseURL}${base}/quiz`);
    await page.locator('input[name="quizTitle"]').fill("Check your understanding");
    await page.getByRole("button", { name: "Save quiz title", exact: true }).click();
    await expect(page.getByText("Quiz settings saved.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${base}/quiz\\?notice=`));
    await expect(page.locator('input[name="quizTitle"]')).toHaveValue("Check your understanding");

    for (const [i, type] of ["single_choice", "multiple_choice"].entries()) {
      checked(await f.editor.rpc("admin_upsert_quiz_question", {
        p_quiz_id: quiz.id, p_question_id: "", p_prompt: type === "single_choice" ? "Choose one answer" : "Choose both useful steps",
        p_question_type: type, p_explanation: "Read and reflect before answering.", p_xp: 5, p_question_order: i + 2,
        p_options: [{ label: "Read", isCorrect: true }, { label: "Reflect", isCorrect: type === "multiple_choice" }, { label: "Skip", isCorrect: false }],
      }));
    }
    await page.getByRole("link", { name: "Next: Values", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Values", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Save value|Add value/ })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Lesson authoring steps" }).getByText("3 questions", { exact: true })).toBeVisible();
    const dimensions = checked(await f.editor.from("value_dimensions").select("id, label").eq("status", "active").order("sort_order").limit(2));
    const [dimension, secondDimension] = dimensions;
    await page.getByRole("checkbox", { name: dimension.label, exact: true }).check();
    await page.getByRole("checkbox", { name: secondDimension.label, exact: true }).check();
    const selectedValue = page.getByRole("region", { name: `${dimension.label} focus`, exact: true });
    await selectedValue.getByRole("radio", { name: /^Supporting/ }).check();
    expect(checked(await f.editor.from("content_value_tags").select("id").eq("content_id", lessonId))).toHaveLength(0);
    // A failed save keeps both selections and stays on the Values step.
    await page.route(`${baseURL}${base}/values`, (route) => route.request().method() === "POST" ? route.abort("failed") : route.continue());
    await page.getByRole("button", { name: "Continue to Review", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "They’re still here" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: secondDimension.label, exact: true })).toBeChecked();
    await page.unroute(`${baseURL}${base}/values`);
    await page.getByRole("button", { name: "Continue to Review", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}${base}/preview`);
    const savedTags = checked(await f.editor.from("content_value_tags").select("id, dimension_id, weight").eq("content_id", lessonId));
    expect(savedTags).toHaveLength(2);
    const tag = savedTags.find((item) => item.dimension_id === dimension.id)!;
    expect(tag.weight).toBe(0.5);
    // Changing guidance preserves a legacy score, including when using the top step navigation.
    checked(await f.service.from("content_value_tags").update({ weight: 0.67, recommended_level: "intermediate" }).eq("id", tag.id));
    await page.goto(`${baseURL}${base}/values`);
    await expect(selectedValue.getByRole("radio", { name: /^Current focus/ })).toBeChecked();
    await selectedValue.getByText("Learner guidance", { exact: false }).click();
    await expect(selectedValue.getByRole("combobox").first()).toHaveText("Building understanding");
    await selectedValue.getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Reflect on it", exact: true }).click();
    await page.getByRole("navigation", { name: "Lesson authoring steps" }).getByRole("link", { name: /^4. Review/ }).click();
    await expect(page).toHaveURL(`${baseURL}${base}/preview`);
    expect(checked(await f.editor.from("content_value_tags").select("weight, outcome_type").eq("id", tag.id).single())).toEqual({ weight: 0.67, outcome_type: "reflection" });
    await page.goto(`${baseURL}${base}/values`);
    await selectedValue.getByRole("radio", { name: /^Supporting/ }).check();
    await page.getByRole("checkbox", { name: secondDimension.label, exact: true }).uncheck();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`lesson-values-${width}.png`), fullPage: true });
    }
    await page.getByRole("button", { name: "Continue to Review", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}${base}/preview`);
    expect(checked(await f.editor.from("content_value_tags").select("dimension_id, weight").eq("content_id", lessonId))).toEqual([{ dimension_id: dimension.id, weight: 0.5 }]);
    for (let i = 0; i < types.length; i += 1) {
      await expect(page.locator(".learner-readable h1")).toHaveText(i === 0 ? "Saved before quiz setup" : `${types[i]} page`);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const card = page.locator(".learner-readable");
        const box = await card.boundingBox();
        const heading = await card.locator("h1").boundingBox();
        expect(heading!.x - box!.x).toBeGreaterThanOrEqual(24);
        await expect(card).toHaveCSS("border-radius", "24px");
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`${types[i]}-${width}.png`), fullPage: true });
      }
      await page.getByRole("navigation", { name: "Preview navigation" }).getByRole("link", { name: i === types.length - 1 ? "Continue to quiz" : "Next page", exact: true }).click();
    }
    await expect(page).toHaveURL(`${baseURL}${base}/preview?section=quiz`);
    await expect(page.getByRole("heading", { name: "Check your understanding", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check answer", exact: true })).toBeDisabled();
    for (let i = 0; i < 3; i += 1) {
      await page.getByRole("button", { name: i === 0 ? "True" : "Read", exact: true }).click();
      if (i === 2) await page.getByRole("button", { name: "Reflect", exact: true }).click();
      await page.getByRole("button", { name: "Check answer", exact: true }).click();
      await expect(page.getByRole("status").getByText("Correct", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: i === 2 ? "Finish preview" : "Next question", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Quiz preview complete", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Restart quiz preview", exact: true }).click();
    await expect(page.getByText("Question 1 of 3", { exact: true })).toBeVisible();
    expect(learnerWrites).toEqual([]);
    // A draft preview never publishes the lesson as a side effect.
    expect(checked(await f.editor.from("lessons").select("status, published_snapshot").eq("id", lessonId).single())).toMatchObject({ status: "draft", published_snapshot: null });
    await page.getByRole("link", { name: "Back to last page", exact: true }).click();
    await expect(page.locator(".learner-readable h1")).toHaveText("summary page");
    await page.getByRole("navigation", { name: "Preview contents" }).getByRole("link", { name: "Review", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Before you publish" })).toBeVisible();
    await expect(page.getByText("1 value chosen to help learners discover this lesson.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark lesson reviewed", exact: true })).toHaveCount(0);
    // Approval remains an explicit action, reached through review rather than the old banner.
    checked(await f.service.from("courses").update({ ai_generated: true, ai_text_status: "draft" }).eq("id", parent.course));
    checked(await f.service.from("lessons").update({ ai_generated: true, ai_text_status: "draft", ai_publish_status: "not_ready" }).eq("id", lessonId));
    await page.goto(`${baseURL}${base}`);
    await expect(page.getByRole("button", { name: "Value tags", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Quiz", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Preview", exact: true })).toHaveCount(0);
    await expect(page.getByText("AI-suggested lesson", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Before you publish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark lesson reviewed", exact: true })).toBeVisible();
    expect(checked(await f.editor.from("lessons").select("ai_text_status, status").eq("id", lessonId).single())).toEqual({ ai_text_status: "draft", status: "draft" });
    await page.getByRole("checkbox", { name: /I have reviewed the lesson text, quiz and any media/ }).check();
    await page.getByRole("button", { name: "Mark lesson reviewed", exact: true }).click();
    await expect(page.getByText("Lesson review complete.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/section=review/);
    expect(checked(await f.editor.from("lessons").select("ai_text_status, ai_media_status, ai_publish_status, status, text_approved_by").eq("id", lessonId).single())).toEqual({ ai_text_status: "approved", ai_media_status: "approved", ai_publish_status: "ready", status: "draft", text_approved_by: f.userId });
    await expect(page.getByRole("link", { name: "Review earlier media and lesson covers", exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("lesson-review.png"), fullPage: true });

  } finally {
    try {
      if (taggedLessonId) checked(await f.service.from("content_value_tags").delete().eq("content_type", "lesson").eq("content_id", taggedLessonId));
    } finally { await f.cleanup(); }
  }
});
