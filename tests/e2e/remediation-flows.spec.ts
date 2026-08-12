import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
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
const uploadedMediaAlt = `E2E uploaded CMS image ${runId}`;
const uploadedCoverAlt = `E2E uploaded CMS cover ${runId}`;
const courseAudience = `Community learners completing a full authoring path ${runId}`;
const courseOutcomeOne = `Explain the responsible choice pattern ${runId}`;
const courseOutcomeTwo = `Apply the pattern in a local scenario ${runId}`;
const authoredLessonTitle = `E2E Authored Lesson ${runId}`;
const authoredLessonSummary = `A lesson authored through the CMS browser journey ${runId}`;
const authoredPageOneTitle = `E2E Authored Page One ${runId}`;
const authoredPageTwoTitle = `E2E Authored Page Two ${runId}`;
const authoredTextHeading = `Browser-authored Tiptap heading ${runId}`;
const authoredTextBody = `This rich text survived the CMS builder journey ${runId}`;
const authoredCalloutTitle = `Browser callout ${runId}`;
const authoredCalloutBody = `This callout was inserted after the text block ${runId}`;
const authoredQuestionOne = `What should an editor verify before publishing ${runId}?`;
const authoredQuestionTwo = `A reviewed course can be published after blockers clear ${runId}.`;
const lessonTitle = `E2E Supported Lesson ${runId}`;
const questionPrompt = `Which action keeps the E2E remediation flow honest ${runId}?`;
const rewardTitle = `E2E Reward ${runId}`;
const learnerEmail = `e2e-learner-${runId}@example.test`;
const adminEmail = `e2e-admin-${runId}@example.test`;
const signupEmail = `e2e-signup-${runId}@example.test`;
const signupName = `E2E Signup ${runId}`;
const institutionalOrgName = `E2E Institution ${runId}`;
const institutionalOrgSlug = `e2e-institution-${runId}`;
const institutionalProgrammeTitle = `E2E Institutional Programme ${runId}`;
const institutionalProgrammeSlug = `e2e-institutional-programme-${runId}`;
const institutionalCohortTitle = `E2E Institutional Cohort ${runId}`;
const institutionalCohortSlug = `e2e-institutional-cohort-${runId}`;
const institutionalCourseId = `e2e-institution-course-${runId}`;
const institutionalLessonId = `e2e-institution-lesson-${runId}`;
const institutionalPageId = `e2e-institution-page-${runId}`;
const institutionalQuizId = `e2e-institution-quiz-${runId}`;
const institutionalQuestionId = `e2e-institution-question-${runId}`;
const institutionalCorrectOptionId = `e2e-institution-option-correct-${runId}`;
const institutionalWrongOptionId = `e2e-institution-option-wrong-${runId}`;
const institutionalNotificationTitle = `E2E Institution Notice ${runId}`;
const institutionalGlobalNotificationTitle = `E2E Global Notice ${runId}`;
const institutionalRewardId = `e2e-institution-reward-${runId}`;
const institutionalCourseTitle = `E2E Private Institution Course ${runId}`;
const institutionalLessonTitle = `E2E Institution Lesson ${runId}`;
const institutionalPageTitle = `E2E Institution Page ${runId}`;
const institutionalLessonBody = `Institution learner content rendered safely ${runId}`;
const programmeManagerEmail = `e2e-programme-manager-${runId}@example.test`;
const reportViewerEmail = `e2e-report-viewer-${runId}@example.test`;
const institutionalLearnerEmail = `e2e-institution-learner-${runId}@example.test`;
const outsiderEmail = `e2e-outsider-${runId}@example.test`;
const selfServiceOwnerEmail = `e2e-self-service-owner-${runId}@example.test`;
const selfServiceOrgName = `E2E Starter Org ${runId}`;
const selfServiceOrgSlug = `e2e-starter-org-${runId}`;
const selfServiceOrgShortName = `Starter ${runId}`;
const selfServiceOrgUpdatedShortName = `Starter Updated ${runId}`;
const selfServiceCourseTitle = `E2E Starter Owner Course ${runId}`;
const cmsUploadFixturePath = path.join(process.cwd(), "tests/fixtures/cms-upload-image.png");

let supabase: SupabaseClient;
let learner: User;
let admin: User;
let programmeManager: User | null = null;
let reportViewer: User | null = null;
let institutionalLearner: User | null = null;
let outsider: User | null = null;
let signedUpLearner: User | null = null;
let selfServiceOwner: User | null = null;

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
  programmeManager = programmeManager ?? (await findAuthUserByEmail(programmeManagerEmail));
  reportViewer = reportViewer ?? (await findAuthUserByEmail(reportViewerEmail));
  institutionalLearner = institutionalLearner ?? (await findAuthUserByEmail(institutionalLearnerEmail));
  outsider = outsider ?? (await findAuthUserByEmail(outsiderEmail));
  selfServiceOwner = selfServiceOwner ?? (await findAuthUserByEmail(selfServiceOwnerEmail));
  const institutionalProgrammeIds = (
    (await supabase
      .from("programmes")
      .select("id")
      .eq("slug", institutionalProgrammeSlug)).data ?? []
  ).map((programme) => programme.id);
  const institutionalOrgIds = (
    (await supabase
      .from("organizations")
      .select("id")
      .eq("slug", institutionalOrgSlug)).data ?? []
  ).map((organization) => organization.id);
  const selfServiceOrgIds = (
    (await supabase
      .from("organizations")
      .select("id")
      .eq("slug", selfServiceOrgSlug)).data ?? []
  ).map((organization) => organization.id);
  const removableCourseResult = await supabase
    .from("courses")
    .select("id")
    .in("title", [blankCourseTitle, updatedBlankCourseTitle, duplicatedCourseTitle]);
  const removableCourseIds = (removableCourseResult.data ?? []).map((course) => course.id);
  if (removableCourseIds.length > 0) {
    const mediaResult = await supabase
      .from("learning_media_assets")
      .select("storage_path")
      .in("course_id", removableCourseIds);
    const storagePaths = (mediaResult.data ?? [])
      .map((asset) => asset.storage_path)
      .filter((path): path is string => Boolean(path));
    if (storagePaths.length > 0) {
      await supabase.storage.from(process.env.LEARNING_MEDIA_BUCKET || "learning-media").remove(storagePaths);
    }
  }

  await supabase.from("reward_redemptions").delete().eq("reward_id", rewardId);
  await supabase.from("reward_redemptions").delete().eq("reward_id", institutionalRewardId);
  await supabase
    .from("xp_transactions")
    .delete()
    .in("user_id", [
      learner?.id,
      admin?.id,
      signedUpLearner?.id,
      programmeManager?.id,
      reportViewer?.id,
      institutionalLearner?.id,
      outsider?.id,
      selfServiceOwner?.id,
    ].filter(Boolean));
  await supabase.from("course_completions").delete().eq("course_id", institutionalCourseId);
  if (institutionalProgrammeIds.length > 0) {
    await supabase
      .from("programme_completions")
      .delete()
      .in("programme_id", institutionalProgrammeIds);
  }
  await supabase.from("enrolments").delete().eq("course_id", institutionalCourseId);
  if (institutionalProgrammeIds.length > 0) {
    await supabase.from("enrolments").delete().in("programme_id", institutionalProgrammeIds);
  }
  await supabase.from("course_assignments").delete().eq("course_id", institutionalCourseId);
  if (institutionalProgrammeIds.length > 0) {
    await supabase
      .from("programme_assignments")
      .delete()
      .in("programme_id", institutionalProgrammeIds);
  }
  await supabase.from("cohorts").delete().eq("slug", institutionalCohortSlug);
  await supabase.from("programmes").delete().eq("slug", institutionalProgrammeSlug);
  await supabase.from("reward_quantity_allocations").delete().eq("reward_id", institutionalRewardId);
  await supabase.from("rewards").delete().eq("id", institutionalRewardId);
  await supabase.from("lesson_page_completions").delete().eq("lesson_id", lessonId);
  await supabase.from("lesson_page_completions").delete().eq("lesson_id", institutionalLessonId);
  await supabase.from("lesson_progress").delete().eq("lesson_id", lessonId);
  await supabase.from("lesson_progress").delete().eq("lesson_id", institutionalLessonId);
  await supabase.from("quiz_answers").delete().eq("question_id", questionId);
  await supabase.from("quiz_attempts").delete().eq("quiz_id", quizId);
  await supabase.from("quiz_answers").delete().eq("question_id", institutionalQuestionId);
  await supabase.from("quiz_attempts").delete().eq("quiz_id", institutionalQuizId);
  await supabase
    .from("user_notifications")
    .delete()
    .in("title", [institutionalNotificationTitle, institutionalGlobalNotificationTitle]);
  await supabase.from("rewards").delete().eq("id", rewardId);
  await supabase
    .from("courses")
    .delete()
    .in("title", [blankCourseTitle, updatedBlankCourseTitle, duplicatedCourseTitle]);
  await supabase.from("courses").delete().eq("id", institutionalCourseId);
  await supabase.from("courses").delete().eq("id", courseId);
  if (selfServiceOrgIds.length > 0) {
    await supabase
      .from("courses")
      .delete()
      .in("organization_id", selfServiceOrgIds);
  }
  if (institutionalOrgIds.length > 0) {
    await supabase
      .from("organization_memberships")
      .delete()
      .in("organization_id", institutionalOrgIds);
    await supabase
      .from("organizations")
      .delete()
      .in("id", institutionalOrgIds);
  }
  if (selfServiceOrgIds.length > 0) {
    await supabase
      .from("organization_memberships")
      .delete()
      .in("organization_id", selfServiceOrgIds);
    await supabase
      .from("organization_invitations")
      .delete()
      .in("organization_id", selfServiceOrgIds);
    await supabase
      .from("organizations")
      .delete()
      .in("id", selfServiceOrgIds);
  }

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

  if (programmeManager?.id) {
    await supabase.auth.admin.deleteUser(programmeManager.id);
    programmeManager = null;
  }

  if (reportViewer?.id) {
    await supabase.auth.admin.deleteUser(reportViewer.id);
    reportViewer = null;
  }

  if (institutionalLearner?.id) {
    await supabase.auth.admin.deleteUser(institutionalLearner.id);
    institutionalLearner = null;
  }

  if (outsider?.id) {
    await supabase.auth.admin.deleteUser(outsider.id);
    outsider = null;
  }

  if (selfServiceOwner?.id) {
    await supabase.auth.admin.deleteUser(selfServiceOwner.id);
    selfServiceOwner = null;
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
  programmeManager = await createTestUser(programmeManagerEmail, "E2E Programme Manager");
  reportViewer = await createTestUser(reportViewerEmail, "E2E Report Viewer");
  institutionalLearner = await createTestUser(institutionalLearnerEmail, "E2E Institution Learner");
  outsider = await createTestUser(outsiderEmail, "E2E Outsider");
  selfServiceOwner = await createTestUser(selfServiceOwnerEmail, "E2E Self Service Owner");

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
        {
          id: programmeManager.id,
          display_name: "E2E Programme Manager",
          role: "learner",
          xp: 0,
          xp_balance_cached: 0,
          redemption_unlocked_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
        {
          id: reportViewer.id,
          display_name: "E2E Report Viewer",
          role: "learner",
          xp: 0,
          xp_balance_cached: 0,
          redemption_unlocked_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
        {
          id: institutionalLearner.id,
          display_name: "E2E Institution Learner",
          role: "learner",
          xp: 100,
          xp_balance_cached: 100,
          redemption_unlocked_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
        {
          id: outsider.id,
          display_name: "E2E Outsider",
          role: "learner",
          xp: 100,
          xp_balance_cached: 100,
          redemption_unlocked_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
        {
          id: selfServiceOwner.id,
          display_name: "E2E Self Service Owner",
          role: "learner",
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
      [learner, programmeManager, reportViewer, institutionalLearner, outsider, selfServiceOwner]
        .filter((user): user is User => Boolean(user))
        .map((user) => ({
          user_id: user.id,
          assessment_completed_at: new Date().toISOString(),
          readiness_level: "beginner",
          profile_summary: {},
        })),
      { onConflict: "user_id" },
    ),
    "seed learner assessment completion",
  );
}

async function seedInstitutionalContent(organizationId: string) {
  await assertNoError(
    await supabase.from("courses").insert({
      id: institutionalCourseId,
      slug: institutionalCourseId,
      title: institutionalCourseTitle,
      description: "Private institutional course for P1 browser coverage.",
      intended_audience: "Institutional learners assigned through a cohort.",
      learning_outcomes: [`Complete private institutional content ${runId}`],
      category: "Institutional",
      level: "beginner",
      status: "published",
      estimated_minutes: 1,
      sort_order: -9_990,
      thumbnail: {},
      catalog_scope: "organization_private",
      organization_id: organizationId,
    }),
    "seed institutional course",
  );

  await assertNoError(
    await supabase.from("lessons").insert({
      id: institutionalLessonId,
      course_id: institutionalCourseId,
      slug: institutionalLessonId,
      title: institutionalLessonTitle,
      subtitle: "Institutional learner path",
      description: "A private lesson assigned through an institutional programme.",
      status: "published",
      retry_mode: "anytime",
      retry_requires_reread: false,
      quiz_requires_lesson_completion: false,
      estimated_minutes: 1,
      sort_order: 1,
    }),
    "seed institutional lesson",
  );

  await assertNoError(
    await supabase.from("lesson_pages").insert({
      id: institutionalPageId,
      lesson_id: institutionalLessonId,
      page_number: 1,
      title: institutionalPageTitle,
      subtitle: "Private lesson page",
      page_type: "concept",
      cover_image: null,
    }),
    "seed institutional lesson page",
  );

  await assertNoError(
    await supabase.from("lesson_content_blocks").insert({
      page_id: institutionalPageId,
      block_type: "text",
      sort_order: 1,
      payload: {
        heading: "Institutional learning",
        body: institutionalLessonBody,
      },
    }),
    "seed institutional lesson content block",
  );

  await assertNoError(
    await supabase.from("quizzes").insert({
      id: institutionalQuizId,
      lesson_id: institutionalLessonId,
      title: "Institutional E2E quiz",
      status: "published",
    }),
    "seed institutional quiz",
  );

  await assertNoError(
    await supabase.from("quiz_questions").insert({
      id: institutionalQuestionId,
      quiz_id: institutionalQuizId,
      question_order: 1,
      question_type: "single_choice",
      prompt: `Which path keeps the institution learner in context ${runId}?`,
      explanation: "Organisation learners should stay on organisation routes until they intentionally return.",
      xp: 5,
    }),
    "seed institutional quiz question",
  );

  await assertNoError(
    await supabase.from("quiz_options").insert([
      {
        id: institutionalCorrectOptionId,
        question_id: institutionalQuestionId,
        option_order: 1,
        label: "Stay inside the organisation workspace",
        is_correct: true,
      },
      {
        id: institutionalWrongOptionId,
        question_id: institutionalQuestionId,
        option_order: 2,
        label: "Jump to the public lesson route",
        is_correct: false,
      },
    ]),
    "seed institutional quiz options",
  );

  await assertNoError(
    await supabase.from("rewards").insert({
      id: institutionalRewardId,
      title: `E2E Institution Reward ${runId}`,
      description: "Tenant-owned reward for P1 browser coverage.",
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
      fulfillment_config: {
        fields: [
          { id: "deliveryMethod", label: "Delivery method", type: "select", options: ["Pickup", "Delivery"], required: true },
        ],
      },
      per_user_limit: 1,
      sort_order: -9_990,
      is_enabled: true,
      total_uploaded: 1,
      total_available: 1,
      visibility_mode: "store",
      distribution_mode: "direct",
      limit_period: "lifetime",
      redemption_window_days: null,
      owner_scope: "organization_owned",
      organization_id: organizationId,
      shared_with_programmes: false,
    }),
    "seed institutional reward",
  );

  await assertNoError(
    await supabase.from("reward_quantity_allocations").insert({
      reward_id: institutionalRewardId,
      quantity_total: 1,
      quantity_available: 1,
      available_from: null,
      expires_at: null,
      reason: "E2E institutional reward inventory",
    }),
    "seed institutional reward quantity allocation",
  );

  if (!institutionalLearner?.id) {
    throw new Error("Institutional learner must be seeded before institutional notifications.");
  }

  await assertNoError(
    await supabase.from("user_notifications").insert([
      {
        user_id: institutionalLearner.id,
        event_type: "organization_contextual_e2e",
        category: "system",
        title: institutionalNotificationTitle,
        body: "Organisation-scoped notification for contextual learner journey coverage.",
        dedupe_key: `e2e-institution-notification-${runId}`,
        cta_label: "Open organisation",
        cta_href: `/o/${institutionalOrgSlug}`,
        data: { organizationId },
      },
      {
        user_id: institutionalLearner.id,
        event_type: "global_contextual_e2e",
        category: "system",
        title: institutionalGlobalNotificationTitle,
        body: "Global notification that must not appear on the organisation notification page.",
        dedupe_key: `e2e-global-notification-${runId}`,
        cta_label: "Open dashboard",
        cta_href: "/dashboard",
        data: {},
      },
    ]),
    "seed institutional notifications",
  );
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter Email Address").fill(email);
  await page.getByPlaceholder("Enter Password").fill(authCredential);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function saveOrganizationMembershipThroughUi(
  page: Page,
  user: User,
  role: string,
  roleLabel: string,
) {
  const membershipForm = page.locator("form").filter({ has: page.locator("select[name='userId']") }).first();
  await membershipForm.locator("select[name='organizationId']").selectOption({ label: institutionalOrgName });
  await membershipForm.locator("select[name='userId']").selectOption(user.id);
  await membershipForm.locator("select[name='role']").selectOption(role);
  await membershipForm.locator("select[name='status']").selectOption("active");
  await membershipForm.getByRole("button", { name: "Save membership" }).click();
  await expect(page.getByText("Membership saved.")).toBeVisible();
  const membershipRow = page.getByRole("row").filter({ hasText: user.id });
  await expect(membershipRow.getByRole("cell", { name: roleLabel, exact: true })).toBeVisible();
}

function getCourseIdFromAdminUrl(page: Page) {
  return page.url().split("/admin/courses/")[1]?.split("?")[0] ?? "";
}

function blockLocator(page: Page, label: string) {
  return page.locator("form").filter({ hasText: label }).first();
}

function richTextBoldButton(block: ReturnType<typeof blockLocator>) {
  return block.locator("button").filter({ hasText: /^B$/ }).first();
}

async function saveLessonBuilder(page: Page) {
  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/learning/builder") &&
      response.request().method() === "POST",
  );
  const inspector = page.locator("aside").filter({ hasText: "Authoring state" }).first();
  await inspector.getByRole("button", { name: "Save now" }).first().click();
  const saveResponse = await saveResponsePromise;
  expect(
    saveResponse.status(),
    await saveResponse.text(),
  ).toBe(200);
  await expect(page.getByText("Lesson content saved.").first()).toBeVisible();
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

    const result = await Promise.any([
      page
        .waitForFunction(
          () => ["/dashboard", "/onboarding/assessment"].includes(window.location.pathname),
          undefined,
          { timeout: 15_000 },
        )
        .then(() => "signed-in" as const),
      page
        .getByRole("heading", { name: "Check your email" })
        .waitFor({ state: "visible", timeout: 15_000 })
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

  test("self-service Starter owner can manage org setup and create only five lessons", async ({ page }) => {
    test.setTimeout(180_000);

    if (!selfServiceOwner) {
      throw new Error("Self-service owner was not seeded.");
    }

    await signIn(page, selfServiceOwnerEmail);
    await page.goto("/org/create");
    await page.getByLabel("Organisation name").fill(selfServiceOrgName);
    await page.getByLabel("Web address").fill(selfServiceOrgSlug);
    await page.getByLabel("Short name").fill(selfServiceOrgShortName);
    await page.getByLabel("Description").fill("Browser-created Starter organisation for P1.5A acceptance.");
    await page.getByLabel("Support email").fill(selfServiceOwnerEmail);
    await page.getByLabel(/I confirm I can create this organisation workspace/).check();
    await page.getByRole("button", { name: "Create organisation" }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Organisation created. Continue setup in your new workspace.")).toBeVisible();

    const organization = await assertNoError(
      await supabase
        .from("organizations")
        .select("id, creation_source, verification_status, lifecycle_status")
        .eq("slug", selfServiceOrgSlug)
        .maybeSingle(),
      "load self-service organization",
    ) as {
      creation_source: string;
      id: string;
      lifecycle_status: string;
      verification_status: string;
    } | null;
    expect(organization?.id).toBeTruthy();
    expect(organization?.creation_source).toBe("self_service");
    expect(organization?.verification_status).toBe("unverified");

    const ownerMembership = await assertNoError(
      await supabase
        .from("organization_memberships")
        .select("id")
        .eq("organization_id", organization?.id ?? "")
        .eq("user_id", selfServiceOwner.id)
        .eq("role", "organisation_owner")
        .eq("status", "active")
        .maybeSingle(),
      "load self-service owner membership",
    ) as { id: string } | null;
    expect(ownerMembership?.id).toBeTruthy();

    await page.goto("/admin/organizations");
    await expect(page.getByRole("heading", { name: "Organisation workspaces" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create or update organisation" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Assign plan" })).toHaveCount(0);
    const identityForm = page.locator("form").filter({ has: page.locator("input[name='shortName']") }).first();
    await identityForm.locator("input[name='shortName']").fill(selfServiceOrgUpdatedShortName);
    await identityForm.locator("textarea[name='description']").fill("Updated by the organisation owner through their workspace.");
    await identityForm.getByRole("button", { name: "Save identity" }).click();
    await expect(page.getByText("Organisation profile updated.")).toBeVisible();
    await expect(page.getByText(selfServiceOrgUpdatedShortName).first()).toBeVisible();

    const invitationForm = page.locator("form").filter({ has: page.locator("input[name='email']") }).first();
    await invitationForm.locator("select[name='organizationId']").selectOption({ label: selfServiceOrgUpdatedShortName });
    await invitationForm.locator("input[name='email']").fill(learnerEmail);
    await invitationForm.locator("select[name='role']").selectOption("learner");
    await invitationForm.getByRole("button", { name: "Create invitation" }).click();
    await expect(page.getByText("Invitation created.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: learnerEmail })).toBeVisible();

    await page.goto("/admin/courses/new");
    await expect(page.getByRole("heading", { name: "Add course" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Generate with AI" })).toHaveCount(0);
    await page.getByLabel("Title").fill(selfServiceCourseTitle);
    await page.getByLabel("Description").fill("Organisation-private course created by the self-service owner.");
    await page.getByLabel("Intended audience").fill("Starter organisation learners.");
    await page.getByLabel("Learning outcomes").fill("Create a course through Org Mode\nRespect Starter lesson limits");
    await page.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByText("Organisation-private course created.")).toBeVisible();

    const selfServiceCourseId = getCourseIdFromAdminUrl(page);
    const selfServiceCourse = await assertNoError(
      await supabase
        .from("courses")
        .select("id, catalog_scope, organization_id")
        .eq("id", selfServiceCourseId)
        .maybeSingle(),
      "load self-service course",
    ) as { catalog_scope: string; id: string; organization_id: string | null } | null;
    expect(selfServiceCourse?.catalog_scope).toBe("organization_private");
    expect(selfServiceCourse?.organization_id).toBe(organization?.id);

    let firstStarterLessonId = "";

    for (let index = 1; index <= 5; index += 1) {
      await page.goto(`/admin/courses/${selfServiceCourseId}?tab=curriculum`);
      await page.getByRole("button", { name: "Create lesson" }).click();
      await expect(page).toHaveURL(/\/admin\/courses\/lessons\//);
      await expect(page.getByText("Lesson created.")).toBeVisible();
      if (!firstStarterLessonId) {
        firstStarterLessonId = page.url().split("/admin/courses/lessons/")[1]?.split("?")[0] ?? "";
        await expect(page.getByRole("tab", { name: "Generate with AI" })).toHaveCount(0);
        await page.getByRole("button", { name: "+ Add page" }).click();
        await expect(page.getByRole("button", { name: "+ Text" })).toBeVisible();
        await expect(page.getByRole("button", { name: "+ Image" })).toBeVisible();
        await expect(page.getByRole("button", { name: "+ Video" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "+ Audio" })).toHaveCount(0);
      }
    }

    const uploadResponse = await page.request.post("/api/admin/learning/media/upload", {
      multipart: {
        altText: `Starter owner image ${runId}`,
        assetType: "image",
        courseId: selfServiceCourseId,
        file: {
          buffer: readFileSync(cmsUploadFixturePath),
          mimeType: "image/png",
          name: "starter-owner-image.png",
        },
        lessonId: firstStarterLessonId,
        placement: "lesson_image",
      },
    });
    const uploadResponseText = await uploadResponse.text();
    expect(uploadResponse.status(), uploadResponseText).toBe(200);
    const parsedUploadPayload = JSON.parse(uploadResponseText) as {
      asset?: { id?: string; storage_path?: string | null };
    };
    const uploadPayload = parsedUploadPayload;
    expect(uploadPayload.asset?.id).toBeTruthy();
    expect(uploadPayload.asset?.storage_path).toBeTruthy();

    const uploadedStarterAsset = await assertNoError(
      await supabase
        .from("learning_media_assets")
        .select("id, storage_path")
        .eq("id", uploadPayload.asset?.id ?? "")
        .maybeSingle(),
      "load starter uploaded media asset",
    ) as { id: string; storage_path: string | null } | null;
    expect(uploadedStarterAsset?.storage_path).toBe(uploadPayload.asset?.storage_path);

    const deleteResponse = await page.request.delete("/api/admin/learning/media/upload", {
      data: { assetId: uploadPayload.asset?.id },
    });
    expect(deleteResponse.status(), await deleteResponse.text()).toBe(200);

    const deletedStarterAsset = await assertNoError(
      await supabase
        .from("learning_media_assets")
        .select("id")
        .eq("id", uploadPayload.asset?.id ?? "")
        .maybeSingle(),
      "verify starter uploaded media asset was deleted",
    ) as { id: string } | null;
    expect(deletedStarterAsset).toBeNull();

    const storagePath = uploadPayload.asset?.storage_path ?? "";
    const storageDirectory = storagePath.split("/").slice(0, -1).join("/");
    const storageName = storagePath.split("/").at(-1) ?? "";
    const listedObjects = await supabase.storage
      .from(process.env.LEARNING_MEDIA_BUCKET || "learning-media")
      .list(storageDirectory);
    if (listedObjects.error) {
      throw new Error(`verify starter storage deletion: ${listedObjects.error.message}`);
    }
    expect(listedObjects.data.some((object) => object.name === storageName)).toBe(false);

    const deniedVideoBlockResponse = await page.request.post("/api/admin/learning/builder", {
      data: {
        lessonId: firstStarterLessonId,
        pages: [
          {
            id: "draft-starter-denied-page",
            title: "Starter denied page",
            page_type: "concept",
            page_number: 1,
          },
        ],
        blocks: [
          {
            id: "draft-starter-denied-video",
            page_id: "draft-starter-denied-page",
            block_type: "video",
            sort_order: 1,
            payload: {
              src: "https://example.test/video.mp4",
              title: "Denied video",
            },
          },
        ],
      },
    });
    expect(deniedVideoBlockResponse.status()).toBe(500);
    await expect(deniedVideoBlockResponse.text()).resolves.toContain("Video and audio lessons are available on paid organisation plans.");

    await page.goto(`/admin/courses/${selfServiceCourseId}?tab=curriculum`);
    await page.getByRole("button", { name: "Create lesson" }).click();
    await expect(page.getByText("Starter organisations can create up to five lessons.")).toBeVisible();

    const lessonCountResult = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", selfServiceCourseId);
    if (lessonCountResult.error) {
      throw new Error(`count self-service lessons: ${lessonCountResult.error.message}`);
    }
    expect(lessonCountResult.count).toBe(5);
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
    await page.getByRole("button", { name: "View History" }).click();
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
    test.setTimeout(180_000);
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
    await expect(page.getByRole("heading", { level: 1, name: blankCourseTitle })).toBeVisible();

    const overviewPanel = page.getByRole("tabpanel", { name: "Overview" });
    const courseIdentitySection = overviewPanel.locator("details").filter({ hasText: "Course identity" });
    await courseIdentitySection.locator("summary").click();
    await courseIdentitySection.getByLabel("Title").fill(updatedBlankCourseTitle);
    await courseIdentitySection.getByLabel("Description").fill("Updated overview copy that should persist after save and refresh.");
    await courseIdentitySection.getByLabel("Intended audience").fill(courseAudience);
    await courseIdentitySection.getByLabel("Learning outcomes").fill(`${courseOutcomeOne}\n${courseOutcomeTwo}`);
    await overviewPanel.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByText("Course saved.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: updatedBlankCourseTitle })).toBeVisible();
    const authoredCourseId = getCourseIdFromAdminUrl(page);
    expect(authoredCourseId).toBeTruthy();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: updatedBlankCourseTitle })).toBeVisible();
    const reloadedOverviewPanel = page.getByRole("tabpanel", { name: "Overview" });
    const reloadedCourseIdentitySection = reloadedOverviewPanel.locator("details").filter({ hasText: "Course identity" });
    await reloadedCourseIdentitySection.locator("summary").click();
    await expect(reloadedCourseIdentitySection.locator("textarea[name='description']")).toHaveValue("Updated overview copy that should persist after save and refresh.");
    await expect(reloadedCourseIdentitySection.locator("textarea[name='intendedAudience']")).toHaveValue(courseAudience);
    await expect(reloadedCourseIdentitySection.locator("textarea[name='learningOutcomes']")).toHaveValue(`${courseOutcomeOne}\n${courseOutcomeTwo}`);

    await page.getByRole("tab", { name: "Curriculum" }).click();
    await expect(page.getByRole("heading", { name: "Lesson sequence" })).toBeVisible();
    await page.getByRole("tab", { name: "Media" }).click();
    await expect(page.getByRole("heading", { name: "Usage and quality" })).toBeVisible();
    await page.getByRole("tab", { name: "Review & Publish" }).click();
    await expect(page.getByRole("heading", { name: "Course readiness" })).toBeVisible();
    await expect(page.getByText("Add at least one active lesson.")).toBeVisible();

    await page.getByRole("tab", { name: "Curriculum" }).click();
    await page.getByRole("button", { name: "Create lesson" }).click();
    await expect(page).toHaveURL(/\/admin\/courses\/lessons\/[^/?]+(\?.*)?$/);
    await expect(page.getByRole("heading", { level: 1, name: /Untitled lesson/ })).toBeVisible();
    const authoredLessonId = page.url().split("/admin/courses/lessons/")[1]?.split("?")[0] ?? "";
    expect(authoredLessonId).toBeTruthy();

    const lessonSetup = page.locator("details").filter({ hasText: "Lesson setup" }).first();
    await lessonSetup.locator("summary").click();
    await lessonSetup.getByLabel("Title").fill(authoredLessonTitle);
    await lessonSetup.getByLabel("Learner summary").fill(authoredLessonSummary);
    await lessonSetup.getByLabel("Status").selectOption("published");
    await lessonSetup.getByLabel("Minutes").fill("4");
    await lessonSetup.getByRole("button", { name: "Save lesson" }).click();
    await expect(page.getByText("Lesson saved.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: authoredLessonTitle })).toBeVisible();

    await page.getByRole("button", { name: "+ Add page" }).click();
    const pageSettings = page.locator("aside").filter({ hasText: "Selected page" }).first();
    await pageSettings.getByLabel("Page title").fill(authoredPageOneTitle);
    await pageSettings.getByLabel("Subtitle").fill("First browser-authored page");
    await pageSettings.getByLabel("Page type").selectOption("primer");
    await page.getByRole("button", { name: "+ Text" }).first().click();
    const textBlock = blockLocator(page, "Text block");
    await textBlock.getByLabel("Heading").fill(authoredTextHeading);
    await richTextBoldButton(textBlock).click();
    await textBlock.locator(".ProseMirror").click();
    await page.keyboard.insertText(authoredTextBody);
    await richTextBoldButton(textBlock).click();
    await page.getByRole("button", { name: "+ Callout" }).first().click();
    const calloutBlock = blockLocator(page, "Callout block");
    await calloutBlock.getByLabel("Callout label").fill("Review");
    await calloutBlock.getByLabel("Title").fill(authoredCalloutTitle);
    await calloutBlock.getByLabel("Body").fill(authoredCalloutBody);
    await page.getByRole("button", { name: "Duplicate" }).last().click();
    await saveLessonBuilder(page);
    await page.getByRole("button", { name: "Move block later" }).first().click();
    await saveLessonBuilder(page);

    await page.getByRole("button", { name: "+ Add page" }).click();
    await pageSettings.getByLabel("Page title").fill(authoredPageTwoTitle);
    await pageSettings.getByLabel("Subtitle").fill("Second browser-authored page");
    await page.getByRole("button", { name: "+ Text" }).first().click();
    const secondPageTextBlock = blockLocator(page, "Text block");
    await secondPageTextBlock.getByLabel("Heading").fill(`Second page heading ${runId}`);
    await secondPageTextBlock.locator(".ProseMirror").click();
    await page.keyboard.insertText(`Second page body ${runId}`);
    await pageSettings.getByRole("button", { name: "Duplicate" }).first().click();
    await page.locator("button[aria-label='Move page earlier']:not([disabled])").first().click();
    await saveLessonBuilder(page);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: authoredLessonTitle })).toBeVisible();
    await expect(page.getByRole("heading", { name: authoredPageOneTitle }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: authoredPageTwoTitle }).first()).toBeVisible();
    await expect(page.getByText(`Copy of ${authoredPageTwoTitle}`).first()).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`${authoredPageOneTitle}.*primer`, "i") }).click();
    const reloadedTextBlock = page.locator("form").filter({ hasText: authoredTextHeading }).first();
    await reloadedTextBlock.scrollIntoViewIfNeeded();
    await expect(reloadedTextBlock.locator(".ProseMirror")).toContainText(authoredTextBody);

    await page.getByRole("heading", { name: "New assessment item" }).scrollIntoViewIfNeeded();
    const newQuestionCard = page.locator("div").filter({ hasText: "New assessment item" }).last();
    await newQuestionCard.getByLabel("Prompt").fill(authoredQuestionOne);
    await expect(newQuestionCard.getByText("At least two answer options are required.")).toBeVisible();
    await newQuestionCard.getByRole("button", { name: "Add option" }).click();
    await newQuestionCard.getByRole("button", { name: "Remove" }).last().click();
    await newQuestionCard.getByLabel("Option 1").fill("Check all blockers, content, and learner preview.");
    await newQuestionCard.getByLabel("Option 2").fill("Publish first and inspect later.");
    await newQuestionCard.getByLabel("Correct").first().check();
    await newQuestionCard.getByLabel("Explanation").fill("Publication follows readiness review.");
    await newQuestionCard.getByRole("button", { name: "Create question" }).click();
    await expect(page.getByText("Question saved.")).toBeVisible();
    await page.getByRole("heading", { name: "New assessment item" }).scrollIntoViewIfNeeded();
    const secondQuestionCard = page.locator("div").filter({ hasText: "New assessment item" }).last();
    await secondQuestionCard.getByLabel("Prompt").fill(authoredQuestionTwo);
    await secondQuestionCard.getByLabel("Type").selectOption("true_false");
    await secondQuestionCard.getByLabel("Explanation").fill("The lifecycle blocks publishing until approval.");
    await secondQuestionCard.getByRole("button", { name: "Create question" }).click();
    await expect(page.getByText("Question saved.")).toBeVisible();
    const savedQuestionCard = page.locator("article").filter({ hasText: authoredQuestionOne }).first();
    await savedQuestionCard.scrollIntoViewIfNeeded();
    await savedQuestionCard.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByText("Question duplicated.")).toBeVisible();
    const reorderedQuestionCard = page.locator("article").filter({ hasText: authoredQuestionOne }).first();
    await reorderedQuestionCard.scrollIntoViewIfNeeded();
    await reorderedQuestionCard.getByRole("button", { name: "Move question down" }).click();
    await expect(page.getByText("Question order saved.")).toBeVisible();
    await page.getByLabel("Editorial status").selectOption("published");
    await page.getByRole("button", { name: "Save quiz" }).click();
    await expect(page.getByText("Quiz settings saved.")).toBeVisible();

    await page.goto(`/admin/courses/${authoredCourseId}?tab=curriculum`);
    await expect(page.getByRole("heading", { name: "Lesson sequence" })).toBeVisible();
    const authoredLessonRow = page.locator("article").filter({ hasText: authoredLessonTitle }).first();
    await authoredLessonRow.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Duplicate lesson" }).click();
    await expect(page.getByText("Lesson duplicated as a draft.")).toBeVisible();
    const duplicatedLessonId = page.url().split("/admin/courses/lessons/")[1]?.split("?")[0] ?? "";
    expect(duplicatedLessonId).toBeTruthy();
    const duplicatedLessonSetup = page.locator("details").filter({ hasText: "Lesson setup" }).first();
    await duplicatedLessonSetup.locator("summary").click();
    await duplicatedLessonSetup.getByLabel("Status").selectOption("published");
    await duplicatedLessonSetup.getByRole("button", { name: "Save lesson" }).click();
    await expect(page.getByText("Lesson saved.")).toBeVisible();
    await page.getByLabel("Editorial status").selectOption("published");
    await page.getByRole("button", { name: "Save quiz" }).click();
    await expect(page.getByText("Quiz settings saved.")).toBeVisible();
    await page.goto(`/admin/courses/${authoredCourseId}?tab=curriculum`);
    await page.locator("article").filter({ hasText: `Copy of ${authoredLessonTitle}` }).getByRole("button", { name: "Move up" }).click();
    await expect(page.getByText("Lesson order saved.")).toBeVisible();

    await page.getByRole("tab", { name: "Overview" }).click();
    const authoredOverviewPanel = page.getByRole("tabpanel", { name: "Overview" });
    const thumbnailSection = authoredOverviewPanel.locator("details").filter({ hasText: "Course thumbnail" });
    await thumbnailSection.locator("summary").click();
    await thumbnailSection.getByRole("tab", { name: "Upload" }).click();
    await thumbnailSection.locator("input[type='file']").setInputFiles({
      buffer: readFileSync(cmsUploadFixturePath),
      mimeType: "image/png",
      name: "authored-thumbnail.png",
    });
    await thumbnailSection.getByLabel("Alt text").fill(uploadedMediaAlt);
    await thumbnailSection.getByRole("button", { name: "Upload media" }).click();
    await expect(thumbnailSection.locator(`img[alt="${uploadedMediaAlt}"]`).first()).toBeVisible();
    await authoredOverviewPanel.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByText("Course saved.")).toBeVisible();

    const coverUploadResponse = await page.request.post("/api/admin/learning/media/upload", {
      multipart: {
        altText: uploadedCoverAlt,
        assetType: "cover",
        courseId: authoredCourseId,
        file: {
          buffer: readFileSync(cmsUploadFixturePath),
          mimeType: "image/png",
          name: "authored-cover.png",
        },
        placement: "course_cover",
      },
    });
    expect(coverUploadResponse.status()).toBe(200);

    await page.goto(`/admin/courses/${authoredCourseId}?tab=review-publish`);
    await expect(page.getByText("Course readiness")).toBeVisible();
    await expect(page.getByText("1 blocker")).toBeVisible();
    await expect(page.getByText("Editorial approval complete")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
    await expect(page.getByText("Draft").first()).toBeVisible();
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByText("Course sent for review.")).toBeVisible();
    await expect(page.getByText("In review").first()).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Course approved for publishing.")).toBeVisible();
    await expect(page.getByText("Approved").first()).toBeVisible();
    await expect(page.getByText("0 blockers")).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Course published.")).toBeVisible();
    await expect(page.getByText("Published").first()).toBeVisible();

    const authoredCourseRow = await assertNoError(
      await supabase
        .from("courses")
        .select("id, intended_audience, learning_outcomes, status, ai_text_status, ai_publish_status")
        .eq("id", authoredCourseId)
        .maybeSingle(),
      "load authored published course",
    ) as {
      ai_publish_status: string;
      ai_text_status: string;
      intended_audience: string;
      learning_outcomes: string[];
      status: string;
    } | null;
    expect(authoredCourseRow?.intended_audience).toBe(courseAudience);
    expect(authoredCourseRow?.learning_outcomes).toEqual([courseOutcomeOne, courseOutcomeTwo]);
    expect(authoredCourseRow?.status).toBe("published");
    expect(authoredCourseRow?.ai_text_status).toBe("approved");
    expect(authoredCourseRow?.ai_publish_status).toBe("published");

    const authoredPages = await assertNoError(
      await supabase
        .from("lesson_pages")
        .select("id, title, page_number")
        .eq("lesson_id", authoredLessonId)
        .order("page_number", { ascending: true }),
      "load authored pages",
    );
    expect(authoredPages.length).toBeGreaterThanOrEqual(3);
    const authoredBlocks = await assertNoError(
      await supabase
        .from("lesson_content_blocks")
        .select("id, block_type, sort_order, payload")
        .in("page_id", authoredPages.map((item) => item.id))
        .order("sort_order", { ascending: true }),
      "load authored blocks",
    );
    expect(authoredBlocks.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(authoredBlocks)).toContain("<strong>");
    expect(JSON.stringify(authoredBlocks)).toContain(authoredTextBody);
    const authoredQuiz = await assertNoError(
      await supabase
        .from("quizzes")
        .select("id")
        .eq("lesson_id", authoredLessonId)
        .maybeSingle(),
      "load authored quiz",
    ) as { id: string } | null;
    expect(authoredQuiz?.id).toBeTruthy();
    const authoredQuestions = await assertNoError(
      await supabase
        .from("quiz_questions")
        .select("id, prompt, question_order, question_type")
        .eq("quiz_id", authoredQuiz?.id ?? "")
        .order("question_order", { ascending: true }),
      "load authored questions",
    );
    expect(authoredQuestions.length).toBeGreaterThanOrEqual(3);

    await page.context().clearCookies();
    await signIn(page, learnerEmail);
    await page.goto(`/courses/${authoredCourseId}`);
    await expect(page.getByRole("heading", { name: updatedBlankCourseTitle }).first()).toBeVisible();
    await expect(page.locator(`img[alt="${uploadedMediaAlt}"]`).first()).toBeAttached();
    for (const pageNumber of [1, 2, 3]) {
      const progressResponse = page.waitForResponse(
        (response) => response.url().includes("/api/lesson-progress") && response.status() === 200,
      );
      await page.goto(`/lessons/${authoredLessonId}?page=${pageNumber}`);
      await progressResponse;
      if (pageNumber === 2) {
        await expect(page.getByText(authoredTextBody)).toBeVisible();
        await expect(page.getByText("<p>")).not.toBeVisible();
      }
    }
    await page.goto(`/quiz/${authoredLessonId}`);
    await expect(page.getByText(authoredQuestionTwo)).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, adminEmail);

    await page.goto("/admin/courses");
    await page.locator("select[name='courseId']").selectOption({ label: courseTitle });
    await page.getByRole("button", { name: "Use template" }).click();
    await expect(page.getByText("Course duplicated as a draft.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: duplicatedCourseTitle })).toBeVisible();
    const duplicatedCourseId = page.url().split("/admin/courses/")[1]?.split("?")[0] ?? "";
    expect(duplicatedCourseId).toBeTruthy();

    await page.getByRole("tab", { name: "Curriculum" }).click();
    await expect(page.getByRole("link", { name: lessonTitle })).toBeVisible();
    await expect(page.getByText("1 questions")).toBeVisible();

    const duplicatedLessons = await assertNoError(
      await supabase
        .from("lessons")
        .select("id, title, status, sort_order")
        .eq("course_id", duplicatedCourseId)
        .order("sort_order", { ascending: true }),
      "load duplicated lessons",
    );
    expect(duplicatedLessons).toHaveLength(1);
    expect(duplicatedLessons[0].id).not.toBe(lessonId);
    expect(duplicatedLessons[0].status).toBe("draft");

    const duplicatedPages = await assertNoError(
      await supabase
        .from("lesson_pages")
        .select("id, title, page_number")
        .eq("lesson_id", duplicatedLessons[0].id)
        .order("page_number", { ascending: true }),
      "load duplicated pages",
    );
    expect(duplicatedPages).toHaveLength(1);
    expect(duplicatedPages[0].id).not.toBe(pageId);

    const duplicatedBlocks = await assertNoError(
      await supabase
        .from("lesson_content_blocks")
        .select("id, block_type, sort_order, payload")
        .eq("page_id", duplicatedPages[0].id)
        .order("sort_order", { ascending: true }),
      "load duplicated content blocks",
    );
    expect(duplicatedBlocks).toHaveLength(1);
    expect(duplicatedBlocks[0].payload).toMatchObject({
      body: "This page lets the E2E suite exercise normal lesson progress.",
    });

    const duplicatedQuiz = await assertNoError(
      await supabase
        .from("quizzes")
        .select("id, status")
        .eq("lesson_id", duplicatedLessons[0].id)
        .maybeSingle(),
      "load duplicated quiz",
    ) as { id: string; status: string } | null;
    expect(duplicatedQuiz?.id).toBeTruthy();
    expect(duplicatedQuiz?.id).not.toBe(quizId);
    expect(duplicatedQuiz?.status).toBe("draft");

    const duplicatedQuestions = await assertNoError(
      await supabase
        .from("quiz_questions")
        .select("id, prompt, question_order")
        .eq("quiz_id", duplicatedQuiz?.id ?? "")
        .order("question_order", { ascending: true }),
      "load duplicated quiz questions",
    );
    expect(duplicatedQuestions).toHaveLength(1);
    expect(duplicatedQuestions[0].id).not.toBe(questionId);
    expect(duplicatedQuestions[0].prompt).toBe(questionPrompt);

    const duplicatedOptions = await assertNoError(
      await supabase
        .from("quiz_options")
        .select("id, question_id, label, option_order, is_correct")
        .eq("question_id", duplicatedQuestions[0].id)
        .order("option_order", { ascending: true }),
      "load duplicated quiz options",
    );
    expect(duplicatedOptions.map((option) => option.label)).toEqual([
      "Use the supported app RPC path",
      "Bypass the app path with a raw write",
    ]);

    await assertNoError(
      await supabase
        .from("lesson_content_blocks")
        .update({ payload: { body: `Copied content changed ${runId}` } })
        .eq("id", duplicatedBlocks[0].id),
      "edit duplicated content block",
    );
    const sourceBlock = await assertNoError(
      await supabase
        .from("lesson_content_blocks")
        .select("payload")
        .eq("page_id", pageId)
        .eq("block_type", "text")
        .maybeSingle(),
      "load source content block",
    ) as { payload: Record<string, unknown> } | null;
    expect(sourceBlock?.payload).toMatchObject({
      body: "This page lets the E2E suite exercise normal lesson progress.",
    });

    await page.getByRole("tab", { name: "Overview" }).click();
    const duplicatedOverviewPanel = page.getByRole("tabpanel", { name: "Overview" });
    const duplicatedThumbnailSection = duplicatedOverviewPanel.locator("details").filter({ hasText: "Course thumbnail" });
    await duplicatedThumbnailSection.locator("summary").click();
    await duplicatedThumbnailSection.getByRole("tab", { name: "Upload" }).click();
    await duplicatedThumbnailSection.locator("input[type='file']").setInputFiles({
      buffer: readFileSync(cmsUploadFixturePath),
      mimeType: "image/png",
      name: "cms-upload-fixture.png",
    });
    await duplicatedThumbnailSection.getByLabel("Alt text").fill(uploadedMediaAlt);
    await duplicatedThumbnailSection.getByRole("button", { name: "Upload media" }).click();
    await expect(duplicatedThumbnailSection.locator(`img[alt="${uploadedMediaAlt}"]`).first()).toBeVisible();
    await duplicatedOverviewPanel.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByText("Course saved.")).toBeVisible();

    const uploadedAsset = await assertNoError(
      await supabase
        .from("learning_media_assets")
        .select("id, course_id, source, storage_path, alt_text, review_status, generation_status")
        .eq("course_id", duplicatedCourseId)
        .eq("alt_text", uploadedMediaAlt)
        .maybeSingle(),
      "load uploaded media asset",
    ) as {
      generation_status: string;
      review_status: string;
      source: string;
      storage_path: string | null;
    } | null;
    expect(uploadedAsset?.source).toBe("uploaded");
    expect(uploadedAsset?.review_status).toBe("approved");
    expect(uploadedAsset?.generation_status).toBe("completed");
    expect(uploadedAsset?.storage_path).toMatch(new RegExp(`^cms/${duplicatedCourseId}/\\d{4}/\\d{2}/[a-zA-Z0-9_-]+\\.png$`));

    const invalidUploadResponse = await page.request.post("/api/admin/learning/media/upload", {
      multipart: {
        altText: "Invalid media",
        assetType: "image",
        courseId: duplicatedCourseId,
        file: {
          buffer: Buffer.from("not an image"),
          mimeType: "text/plain",
          name: "invalid.txt",
        },
        placement: "course_thumbnail",
      },
    });
    expect(invalidUploadResponse.status()).toBe(400);

    await page.goto("/admin/courses/ai/planner");
    await expect(page.getByRole("heading", { name: "Create with AI" })).toBeVisible();
    await expect(page.getByText("1. Learning need")).toBeVisible();
    await expect(page.getByText("2. Intended audience")).toBeVisible();
    await expect(page.getByText("3. Learning outcomes and constraints")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Proposals" })).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, learnerEmail);
    const learnerUploadResponse = await page.request.post("/api/admin/learning/media/upload", {
      multipart: {
        altText: "Learner upload",
        assetType: "image",
        courseId: duplicatedCourseId,
        file: {
          buffer: readFileSync(cmsUploadFixturePath),
          mimeType: "image/png",
          name: "learner-upload.png",
        },
        placement: "course_thumbnail",
      },
    });
    expect([401, 403]).toContain(learnerUploadResponse.status());
  });

  test("institutional LMS journey covers memberships, assignment, completion, reporting, and tenant denial", async ({ page }) => {
    test.setTimeout(180_000);

    if (!programmeManager || !reportViewer || !institutionalLearner || !outsider) {
      throw new Error("Institutional E2E users were not seeded.");
    }

    await signIn(page, adminEmail);
    await page.goto("/admin/organizations");
    await expect(page.getByRole("heading", { name: "Organisation workspaces" })).toBeVisible();

    const organizationForm = page.locator("form").filter({ has: page.locator("input[name='name']") }).first();
    await organizationForm.locator("select[name='organizationId']").selectOption("");
    await organizationForm.locator("input[name='name']").fill(institutionalOrgName);
    await organizationForm.locator("input[name='slug']").fill(institutionalOrgSlug);
    await organizationForm.locator("select[name='status']").selectOption("published");
    await organizationForm.getByRole("button", { name: "Save organisation" }).click();
    await expect(page.getByText("Organisation created.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: institutionalOrgName })).toBeVisible();

    const organization = await assertNoError(
      await supabase
        .from("organizations")
        .select("id")
        .eq("slug", institutionalOrgSlug)
        .maybeSingle(),
      "load institutional organization",
    ) as { id: string } | null;
    expect(organization?.id).toBeTruthy();

    await saveOrganizationMembershipThroughUi(page, programmeManager, "programme_manager", "Programme manager");
    await saveOrganizationMembershipThroughUi(page, reportViewer, "report_viewer", "Report viewer");
    await saveOrganizationMembershipThroughUi(page, institutionalLearner, "learner", "Learner");
    await seedInstitutionalContent(organization?.id ?? "");

    await page.context().clearCookies();
    await signIn(page, programmeManagerEmail);
    await page.goto("/admin/programmes/new");
    await expect(page.getByRole("heading", { name: "Add programme" })).toBeVisible();
    await page.locator("select[name='organizationId']").selectOption({ label: institutionalOrgName });
    await page.locator("select[name='status']").selectOption("published");
    await page.locator("input[name='title']").fill(institutionalProgrammeTitle);
    await page.locator("input[name='slug']").fill(institutionalProgrammeSlug);
    await page.locator("textarea[name='objective']").fill("Deliver private institutional learning through a managed programme.");
    await page.locator("textarea[name='intendedAudience']").fill("Learners assigned by the institution.");
    const courseCheckbox = page.getByRole("checkbox", { name: `Select ${institutionalCourseTitle}` });
    const courseChoice = courseCheckbox.locator("xpath=ancestor::div[contains(@class, 'md:grid-cols')][1]");
    await courseCheckbox.check();
    await courseChoice.locator("input[type='number']").fill("1");
    await page.locator("input[name='minimumCompletionThreshold']").fill("100");
    await page.getByRole("button", { name: "Save programme" }).click();
    await expect(page.getByText("Programme created.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: institutionalProgrammeTitle })).toBeVisible();

    const programme = await assertNoError(
      await supabase
        .from("programmes")
        .select("id")
        .eq("slug", institutionalProgrammeSlug)
        .maybeSingle(),
      "load institutional programme",
    ) as { id: string } | null;
    expect(programme?.id).toBeTruthy();

    await page.goto("/admin/cohorts/new");
    await expect(page.getByRole("heading", { name: "Add cohort" })).toBeVisible();
    await page.locator("select[name='organizationId']").selectOption({ label: institutionalOrgName });
    await page.locator("select[name='status']").selectOption("published");
    await page.locator("input[name='title']").fill(institutionalCohortTitle);
    await page.locator("input[name='slug']").fill(institutionalCohortSlug);
    await page.locator("textarea[name='description']").fill("Browser-created institutional learner cohort.");
    await page.locator("textarea[name='bulkMemberUserIds']").fill(institutionalLearner.id);
    await page.getByRole("button", { name: "Save cohort" }).click();
    await expect(page.getByText("Cohort created.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: institutionalCohortTitle })).toBeVisible();
    await expect(page.getByText(institutionalLearner.id).first()).toBeVisible();

    const cohort = await assertNoError(
      await supabase
        .from("cohorts")
        .select("id")
        .eq("slug", institutionalCohortSlug)
        .maybeSingle(),
      "load institutional cohort",
    ) as { id: string } | null;
    expect(cohort?.id).toBeTruthy();

    const programmeAssignmentForm = page.locator("form").filter({ has: page.locator("select[name='programmeId']") }).first();
    await programmeAssignmentForm.locator("select[name='programmeId']").selectOption({ label: institutionalProgrammeTitle });
    await programmeAssignmentForm.getByRole("button", { name: "Assign programme" }).click();
    await expect(page.getByText("Programme assignment saved.")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: institutionalProgrammeTitle }).first()).toBeVisible();

    const programmeEnrolment = await assertNoError(
      await supabase
        .from("enrolments")
        .select("id")
        .eq("user_id", institutionalLearner.id)
        .eq("programme_id", programme?.id ?? "")
        .maybeSingle(),
      "load institutional learner programme enrolment",
    ) as { id: string } | null;
    expect(programmeEnrolment?.id).toBeTruthy();
    const courseEnrolment = await assertNoError(
      await supabase
        .from("enrolments")
        .select("id")
        .eq("user_id", institutionalLearner.id)
        .eq("course_id", institutionalCourseId)
        .contains("metadata", { programmeId: programme?.id ?? "" })
        .maybeSingle(),
      "load institutional learner derived course enrolment",
    ) as { id: string } | null;
    expect(courseEnrolment?.id).toBeTruthy();

    await page.context().clearCookies();
    await signIn(page, institutionalLearnerEmail);
    await page.goto(`/o/${institutionalOrgSlug}/learn/${institutionalCourseId}`);
    await expect(page.getByRole("heading", { name: institutionalCourseTitle }).first()).toBeVisible();
    const progressResponse = page.waitForResponse(
      (response) => response.url().includes("/api/lesson-progress"),
    );
    await page.getByRole("link", { name: new RegExp(institutionalLessonTitle) }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/o/${institutionalOrgSlug}/learn/${institutionalCourseId}/lessons/${institutionalLessonId}(\\?programmeId=[^&]+)?$`),
    );
    const progressResult = await progressResponse;
    expect(progressResult.status(), await progressResult.text()).toBe(200);
    await expect(page.getByText(institutionalLessonBody)).toBeVisible();
    await page.getByRole("link", { name: "Take Quiz" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/o/${institutionalOrgSlug}/learn/${institutionalCourseId}/quiz/${institutionalLessonId}(\\?programmeId=[^&]+)?$`),
    );
    await expect(page.getByRole("heading", { name: "Institutional E2E quiz" })).toBeVisible();
    await page.getByRole("button", { name: "Stay inside the organisation workspace" }).click();
    await page.getByRole("button", { name: "View result" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/o/${institutionalOrgSlug}/learn/${institutionalCourseId}/results/${institutionalLessonId}(\\?programmeId=[^&]+)?$`),
    );
    await expect(page.getByText("You earned 5 XP!")).toBeVisible();
    const institutionalAccount = await assertNoError(
      await supabase
        .from("xp_accounts")
        .select("id")
        .eq("organization_id", organization?.id ?? "")
        .eq("is_default", true)
        .maybeSingle(),
      "load institutional XP account",
    ) as { id: string } | null;
    const scopedQuizTransaction = await assertNoError(
      await supabase
        .from("xp_transactions")
        .select("id, programme_id, xp_account_id")
        .eq("user_id", institutionalLearner.id)
        .eq("source_type", "quiz_question")
        .eq("xp_account_id", institutionalAccount?.id ?? "")
        .maybeSingle(),
      "load scoped quiz transaction",
    ) as { id: string; programme_id: string | null; xp_account_id: string } | null;
    expect(scopedQuizTransaction?.programme_id).toBe(programme?.id);
    expect(scopedQuizTransaction?.xp_account_id).toBe(institutionalAccount?.id);
    const contextualPage = await assertNoError<{ programme_id: string } | null>(
      await supabase
        .from("programme_lesson_page_completions")
        .select("programme_id")
        .eq("user_id", institutionalLearner.id)
        .eq("programme_id", programme?.id ?? "")
        .eq("lesson_id", institutionalLessonId)
        .eq("page_id", institutionalPageId)
        .maybeSingle(),
      "load contextual lesson completion",
    );
    expect(contextualPage?.programme_id).toBe(programme?.id);
    await page.getByRole("link", { name: "Lessons" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${institutionalOrgSlug}/learn/${institutionalCourseId}(\\?programmeId=[^&]+)?$`));
    await page.goto(`/o/${institutionalOrgSlug}`);
    await page.getByRole("link", { name: "Notifications" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${institutionalOrgSlug}/notifications$`));
    await expect(page.getByRole("heading", { name: institutionalNotificationTitle })).toBeVisible();
    await expect(page.getByRole("heading", { name: institutionalGlobalNotificationTitle })).toHaveCount(0);
    await page.goto(`/o/${institutionalOrgSlug}`);
    await page.getByRole("link", { name: "Return to Project Ve" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto(`/o/${institutionalOrgSlug}/learn/${institutionalCourseId}`);
    await expect(page.getByRole("heading", { name: institutionalCourseTitle }).first()).toBeVisible();
    await page.goto(`/o/${institutionalOrgSlug}/transcript`);
    await expect(page.getByRole("heading", { name: institutionalCourseTitle }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: institutionalProgrammeTitle }).first()).toBeVisible();
    await expect(page.getByText("100% complete").first()).toBeVisible();

    await page.goto(`/o/${institutionalOrgSlug}/rewards`);
    await expect(page.getByRole("heading", { name: `${institutionalOrgName} Rewards` })).toBeVisible();
    await expect(page.getByRole("heading", { name: `E2E Institution Reward ${runId}` }).first()).toBeVisible();
    const redeemButton = page.getByRole("button", { name: "Redeem" }).first();
    await expect(redeemButton).toBeEnabled();
    await redeemButton.click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("combobox", { name: "Delivery method" })).toBeVisible();
    await page.getByRole("combobox", { name: "Delivery method" }).selectOption({ label: "Delivery" });
    await page.getByRole("button", { name: "Submit Details" }).click();
    await expect(page.getByText("Submitted for processing.")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, reportViewerEmail);
    await page.goto("/admin");
    await page.getByRole("button", { name: /Learning/ }).click();
    await expect(page.getByRole("link", { name: "Reporting" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Programmes" })).toHaveCount(0);
    await page.goto("/admin/programmes");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/cohorts");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/reporting?organizationId=${organization?.id}&programmeId=${programme?.id}&cohortId=${cohort?.id}`);
    await expect(page.getByRole("heading", { name: "LMS reporting" })).toBeVisible();
    const learnerReportRow = page.getByRole("row").filter({ hasText: institutionalLearner.id });
    await expect(learnerReportRow.getByText("E2E Institution Learner")).toBeVisible();
    await expect(learnerReportRow.getByRole("cell", { name: institutionalCohortTitle })).toBeVisible();
    await expect(learnerReportRow.getByRole("cell", { name: "100%" })).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, outsiderEmail);
    await page.goto(`/courses/${institutionalCourseId}`);
    await expect(page.getByRole("heading", { name: institutionalCourseTitle })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(institutionalLessonBody);
    const outsiderRewardSnapshot = await page.request.get("/api/rewards");
    expect(outsiderRewardSnapshot.status()).toBe(200);
    expect(await outsiderRewardSnapshot.text()).not.toContain(institutionalRewardId);
    const outsiderRedeemResponse = await page.request.post(`/api/rewards/${institutionalRewardId}/redeem`);
    expect(outsiderRedeemResponse.status()).toBe(400);
  });
});
