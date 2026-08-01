import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const authCredential = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const runId = randomUUID().slice(0, 8);
const courseId = `e2e-course-${runId}`;
const lessonId = `e2e-lesson-${runId}`;
const pageId = `e2e-page-${runId}`;
const quizId = `e2e-quiz-${runId}`;
const questionId = `e2e-question-${runId}`;
const correctOptionId = `e2e-option-correct-${runId}`;
const wrongOptionId = `e2e-option-wrong-${runId}`;
const rewardId = `e2e-reward-${runId}`;
const courseTitle = `E2E Remediation Course ${runId}`;
const blankCourseTitle = `E2E CMS Blank Course ${runId}`;
const updatedBlankCourseTitle = `E2E CMS Updated Course ${runId}`;
const duplicatedCourseTitle = `Copy of ${courseTitle}`;
const lessonTitle = `E2E Supported Lesson ${runId}`;
const questionPrompt = `Which action keeps the E2E remediation flow honest ${runId}?`;
const rewardTitle = `E2E Reward ${runId}`;
const learnerEmail = `e2e-learner-${runId}@example.test`;
const adminEmail = `e2e-admin-${runId}@example.test`;
const signupEmail = `e2e-signup-${runId}@example.test`;
const signupName = `E2E Signup ${runId}`;

let supabase: SupabaseClient;
let learner: User;
let admin: User;
let signedUpLearner: User | null = null;

type SignupProfile = {
  display_name: string | null;
  role: string;
  xp: number;
  xp_balance_cached: number;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for remediation E2E tests.`);
  }

  return value;
}

async function assertNoError<T>(
  result: { data: T; error: null } | { data: T | null; error: Error },
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
    user_metadata: {
      display_name: displayName,
    },
  });

  if (result.error || !result.data.user) {
    throw new Error(result.error?.message ?? `Could not create ${email}.`);
  }

  return result.data.user;
}

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 5; page += 1) {
    const result = await supabase.auth.admin.listUsers({ page, perPage: 200 });

    if (result.error) {
      throw new Error(`list users: ${result.error.message}`);
    }

    const user = result.data.users.find((candidate) => candidate.email === email) ?? null;

    if (user) {
      return user;
    }

    if (result.data.users.length < 200) {
      return null;
    }
  }

  throw new Error(`Could not find ${email} in the first 1000 local auth users.`);
}

async function cleanupFixture() {
  signedUpLearner = signedUpLearner ?? (await findAuthUserByEmail(signupEmail));

  await supabase.from("reward_redemptions").delete().eq("reward_id", rewardId);
  await supabase
    .from("xp_transactions")
    .delete()
    .in("user_id", [learner?.id, admin?.id, signedUpLearner?.id].filter(Boolean));
  await supabase.from("lesson_page_completions").delete().eq("lesson_id", lessonId);
  await supabase.from("lesson_progress").delete().eq("lesson_id", lessonId);
  await supabase.from("quiz_answers").delete().eq("question_id", questionId);
  await supabase.from("quiz_attempts").delete().eq("quiz_id", quizId);
  await supabase.from("rewards").delete().eq("id", rewardId);
  await supabase
    .from("courses")
    .delete()
    .in("title", [blankCourseTitle, updatedBlankCourseTitle, duplicatedCourseTitle]);
  await supabase.from("courses").delete().eq("id", courseId);

  if (learner?.id) {
    await supabase.auth.admin.deleteUser(learner.id);
  }

  if (admin?.id) {
    await supabase.auth.admin.deleteUser(admin.id);
  }

  if (signedUpLearner?.id) {
    await supabase.auth.admin.deleteUser(signedUpLearner.id);
    signedUpLearner = null;
  }
}

async function seedContent() {
  await assertNoError(
    await supabase.from("courses").insert({
      id: courseId,
      slug: courseId,
      title: courseTitle,
      description: "Throwaway course for remediation browser coverage.",
      category: "E2E",
      level: "beginner",
      status: "published",
      estimated_minutes: 1,
      sort_order: -10_000,
      thumbnail: {},
    }),
    "seed course",
  );

  await assertNoError(
    await supabase.from("lessons").insert({
      id: lessonId,
      course_id: courseId,
      slug: lessonId,
      title: lessonTitle,
      subtitle: "Supported remediation path",
      description: "A local E2E lesson that can be completed through the app.",
      status: "published",
      retry_mode: "anytime",
      retry_requires_reread: false,
      quiz_requires_lesson_completion: true,
      estimated_minutes: 1,
      sort_order: 1,
    }),
    "seed lesson",
  );

  await assertNoError(
    await supabase.from("lesson_pages").insert({
      id: pageId,
      lesson_id: lessonId,
      page_number: 1,
      title: "Supported progress page",
      subtitle: "Read-only browser fixture",
      page_type: "concept",
      cover_image: null,
    }),
    "seed lesson page",
  );

  await assertNoError(
    await supabase.from("lesson_content_blocks").insert({
      page_id: pageId,
      block_type: "text",
      sort_order: 1,
      payload: {
        heading: "Browser flow",
        body: "This page lets the E2E suite exercise normal lesson progress.",
      },
    }),
    "seed lesson content block",
  );

  await assertNoError(
    await supabase.from("quizzes").insert({
      id: quizId,
      lesson_id: lessonId,
      title: "Supported E2E quiz",
      status: "published",
    }),
    "seed quiz",
  );

  await assertNoError(
    await supabase.from("quiz_questions").insert({
      id: questionId,
      quiz_id: quizId,
      question_order: 1,
      question_type: "single_choice",
      prompt: questionPrompt,
      explanation: "The supported app RPC path is the expected answer.",
      xp: 5,
    }),
    "seed quiz question",
  );

  await assertNoError(
    await supabase.from("quiz_options").insert([
      {
        id: correctOptionId,
        question_id: questionId,
        option_order: 1,
        label: "Use the supported app RPC path",
        is_correct: true,
      },
      {
        id: wrongOptionId,
        question_id: questionId,
        option_order: 2,
        label: "Bypass the app path with a raw write",
        is_correct: false,
      },
    ]),
    "seed quiz options",
  );

  await assertNoError(
    await supabase.from("rewards").insert({
      id: rewardId,
      title: rewardTitle,
      description: "A throwaway reward for remediation browser coverage.",
      cost_xp: 5,
      inventory_count: 1,
      starts_at: null,
      ends_at: null,
      status: "published",
      thumbnail: {},
      offer_expires_at: null,
      terms: "E2E only.",
      claim_steps: [],
      fulfillment_type: "manual",
      fulfillment_config: {},
      per_user_limit: 1,
      sort_order: -10_000,
      is_enabled: true,
      total_uploaded: 1,
      total_available: 1,
      visibility_mode: "store",
      distribution_mode: "direct",
      limit_period: "lifetime",
      redemption_window_days: null,
    }),
    "seed reward",
  );

  await assertNoError(
    await supabase.from("reward_quantity_allocations").insert({
      reward_id: rewardId,
      quantity_total: 1,
      quantity_available: 1,
      available_from: null,
      expires_at: null,
      reason: "E2E remediation fixture inventory",
    }),
    "seed reward quantity allocation",
  );
}

async function seedUsers() {
  learner = await createTestUser(learnerEmail, "E2E Learner");
  admin = await createTestUser(adminEmail, "E2E Admin");

  await assertNoError(
    await supabase.from("profiles").upsert(
      [
        {
          id: learner.id,
          display_name: "E2E Learner",
          role: "learner",
          xp: 100,
          xp_balance_cached: 100,
          redemption_unlocked_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
        {
          id: admin.id,
          display_name: "E2E Admin",
          role: "admin",
          xp: 0,
          xp_balance_cached: 0,
          redemption_unlocked_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
      { onConflict: "id" },
    ),
    "seed profiles",
  );

  await assertNoError(
    await supabase.from("user_value_profiles").upsert(
      {
        user_id: learner.id,
        assessment_completed_at: new Date().toISOString(),
        readiness_level: "beginner",
        profile_summary: {},
      },
      { onConflict: "user_id" },
    ),
    "seed learner assessment completion",
  );
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter Email Address").fill(email);
  await page.getByPlaceholder("Enter Password").fill(authCredential);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.serial("remediation browser flows", () => {
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

    await cleanupFixture();
    await seedContent();
    await seedUsers();
  });

  test.afterAll(async () => {
    await cleanupFixture();
  });

  test("learner can create an account through the real signup flow", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.getByPlaceholder("Enter Full Name").fill(signupName);
    await page.getByPlaceholder("Enter Email Address").fill(signupEmail);
    await page.getByPlaceholder("Enter Password").fill(authCredential);
    await page.getByLabel(/I agree to the Terms/).check();

    const signupResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/signup") &&
        response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "Create Account" }).click();
    const signupResponse = await signupResponsePromise;

    expect(signupResponse.status()).toBe(200);

    const result = await Promise.race([
      page
        .waitForURL(/\/(dashboard|onboarding\/assessment)$/, { timeout: 10_000 })
        .then(() => "signed-in" as const),
      page
        .getByRole("heading", { name: "Check your email" })
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(() => "confirmation" as const),
    ]);

    if (result === "confirmation") {
      await expect(page.getByText(signupEmail)).toBeVisible();
    }

    await expect
      .poll(
        async () => {
          const user = await findAuthUserByEmail(signupEmail);
          signedUpLearner = user;

          if (!user) {
            return "missing-user";
          }

          const profileResult = await supabase
            .from("profiles")
            .select("display_name, role, xp, xp_balance_cached")
            .eq("id", user.id)
            .maybeSingle();

          if (profileResult.error) {
            throw new Error(`load signed-up profile: ${profileResult.error.message}`);
          }

          const profile = profileResult.data as SignupProfile | null;

          if (!profile) {
            return "missing-profile";
          }

          return `${profile.display_name}:${profile.role}:${profile.xp}:${profile.xp_balance_cached}`;
        },
        { timeout: 10_000 },
      )
      .toBe(`${signupName}:learner:0:0`);
  });

  test("password login stays reachable", async ({ page }) => {
    await signIn(page, learnerEmail);
  });

  test("learner completes a lesson page and earns quiz XP through supported APIs", async ({ page }) => {
    await signIn(page, learnerEmail);

    await page.goto(`/lessons/${lessonId}`);
    await expect(page.getByText("Supported progress page")).toBeVisible();
    await expect(page.getByText("This page lets the E2E suite exercise normal lesson progress.")).toBeVisible();
    await page.waitForResponse(
      (response) => response.url().includes("/api/lesson-progress") && response.status() === 200,
    );

    await page.getByRole("link", { name: "Take Quiz" }).click();
    await expect(page).toHaveURL(new RegExp(`/quiz/${lessonId}$`));
    await expect(page.getByText(questionPrompt)).toBeVisible();
    await page.getByRole("button", { name: "Use the supported app RPC path" }).click();
    await page.getByRole("button", { name: "View result" }).click();

    await expect(page).toHaveURL(new RegExp(`/results/${lessonId}$`));
    await expect(page.getByRole("heading", { name: "You earned 5 XP!" })).toBeVisible();
    await expect(page.getByText("No missed questions")).toBeVisible();
  });

  test("learner redeems a reward and sees it in history", async ({ page }) => {
    await signIn(page, learnerEmail);

    await page.goto("/xp-store");
    await expect(page.getByRole("heading", { name: "Redeem XP rewards" })).toBeVisible();
    const rewardCard = page.locator("section").filter({ hasText: rewardTitle }).first();
    await expect(rewardCard.getByRole("heading", { name: rewardTitle })).toBeVisible();
    await rewardCard.getByRole("button", { name: "Redeem" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByText("Reward added to your history.")).toBeVisible();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByRole("heading", { name: rewardTitle }).first()).toBeVisible();
  });

  test("admin can use the course status workflow for owned fixture content", async ({ page }) => {
    await signIn(page, adminEmail);

    await page.goto("/admin/courses");
    await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
    const courseRow = page.getByRole("row").filter({ hasText: courseTitle });
    await expect(courseRow.getByText("Published")).toBeVisible();
    await courseRow.getByRole("button", { name: `More actions for ${courseTitle}` }).click();
    await page.getByRole("menuitem", { name: "Disable course" }).click();
    await expect(page.getByRole("alertdialog", { name: "Disable published course?" })).toBeVisible();
    await page.getByRole("button", { name: "Disable course" }).click();

    await expect(page.getByText("Course disabled.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: courseTitle }).getByText("Draft")).toBeVisible();
  });

  test("admin CMS workspace covers creation paths, persistence, tabs, templates, and deterministic AI entry", async ({ page }) => {
    await signIn(page, adminEmail);

    await page.goto("/admin/courses");
    await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start blank" })).toBeVisible();
    await expect(page.getByText("Duplicate an existing course")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create with AI" })).toBeVisible();

    await page.getByRole("link", { name: "Start blank" }).click();
    await expect(page.getByRole("heading", { name: "Add course" })).toBeVisible();
    await page.getByLabel("Title").fill(blankCourseTitle);
    await page.getByLabel("Description").fill("A browser-created CMS draft for regression coverage.");
    await page.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByText("Course saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: blankCourseTitle })).toBeVisible();

    await page.getByLabel("Title").fill(updatedBlankCourseTitle);
    await page.getByLabel("Description").fill("Updated overview copy that should persist after save and refresh.");
    await page.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByText("Course saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: updatedBlankCourseTitle })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: updatedBlankCourseTitle })).toBeVisible();
    await expect(page.locator("textarea[name='description']")).toHaveValue("Updated overview copy that should persist after save and refresh.");

    await page.getByRole("tab", { name: "Curriculum" }).click();
    await expect(page.getByRole("heading", { name: "Lesson sequence" })).toBeVisible();
    await page.getByRole("tab", { name: "Media" }).click();
    await expect(page.getByRole("heading", { name: "Usage and quality" })).toBeVisible();
    await page.getByRole("tab", { name: "Review & Publish" }).click();
    await expect(page.getByRole("heading", { name: "Course readiness" })).toBeVisible();

    await page.goto("/admin/courses");
    await page.locator("select[name='courseId']").selectOption({ label: courseTitle });
    await page.getByRole("button", { name: "Use template" }).click();
    await expect(page.getByText("Course duplicated as a draft.")).toBeVisible();
    await expect(page.getByRole("heading", { name: duplicatedCourseTitle })).toBeVisible();

    await page.goto("/admin/courses/ai/planner");
    await expect(page.getByRole("heading", { name: "Create with AI" })).toBeVisible();
    await expect(page.getByText("1. Learning need")).toBeVisible();
    await expect(page.getByText("2. Intended audience")).toBeVisible();
    await expect(page.getByText("3. Learning outcomes and constraints")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Proposals" })).toBeVisible();
  });
});
