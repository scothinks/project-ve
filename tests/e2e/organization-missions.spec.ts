import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const authCredential = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const runId = randomUUID().slice(0, 8);
const orgSlug = `e2e-org-missions-${runId}`;
const orgName = `E2E Org Missions ${runId}`;
const courseId = `e2e-org-mission-course-${runId}`;
const lessonId = `e2e-org-mission-lesson-${runId}`;
const pageId = `e2e-org-mission-page-${runId}`;
const programmeId = randomUUID();
const orgWideMissionId = `e2e-org-wide-mission-${runId}`;
const programmeMissionId = `e2e-programme-mission-${runId}`;
const catalogueMissionId = `e2e-catalogue-mission-${runId}`;
const automaticToken = `e2eauto${runId}token`;
const manualToken = `e2emanual${runId}token`;
const managerEmail = `e2e-org-mission-manager-${runId}@example.test`;
const orgLearnerEmail = `e2e-org-mission-member-${runId}@example.test`;
const autoLearnerEmail = `e2e-org-mission-auto-${runId}@example.test`;
const manualLearnerEmail = `e2e-org-mission-manual-${runId}@example.test`;

let supabase: SupabaseClient;
let organizationId: string;
let manager: User;
let orgLearner: User;
let autoLearner: User;
let manualLearner: User;

type OrganizationIdRow = {
  id: string;
};

type PendingEnrolmentRow = {
  id: string;
  status: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for organization mission E2E tests.`);
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
    user_metadata: {
      display_name: displayName,
    },
  });

  if (result.error || !result.data.user) {
    throw new Error(result.error?.message ?? `Could not create ${email}.`);
  }

  return result.data.user;
}

async function signIn(page: Page, email: string, nextPath = "/dashboard") {
  await page.goto(nextPath.startsWith("/login?") ? nextPath : `/login?next=${encodeURIComponent(nextPath)}`);
  if (await page.getByPlaceholder("Enter Full Name").isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Login" }).last().click();
  }
  await page.getByPlaceholder("Enter Email Address").fill(email);
  await page.getByPlaceholder("Enter Password").fill(authCredential);
  await page.getByRole("button", { name: "Login" }).click();
}

async function clearBrowserState(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.clear());
}

async function cleanupFixture() {
  await supabase.from("contextual_referral_tokens").delete().in("token", [automaticToken, manualToken]);
  await supabase.from("referral_attributions").delete().in("referral_code", [automaticToken, manualToken]);
  await supabase.from("mission_awards").delete().in("mission_id", [orgWideMissionId, programmeMissionId, catalogueMissionId]);
  await supabase.from("mission_proofs").delete().in("mission_id", [orgWideMissionId, programmeMissionId, catalogueMissionId]);
  await supabase.from("programme_missions").delete().eq("programme_id", programmeId);
  await supabase.from("missions").delete().in("id", [orgWideMissionId, programmeMissionId, catalogueMissionId]);
  await supabase.from("enrolments").delete().eq("organization_id", organizationId || "00000000-0000-0000-0000-000000000000");
  await supabase.from("programme_courses").delete().eq("programme_id", programmeId);
  await supabase.from("programmes").delete().eq("id", programmeId);
  await supabase.from("lesson_content_blocks").delete().eq("page_id", pageId);
  await supabase.from("lesson_pages").delete().eq("id", pageId);
  await supabase.from("lessons").delete().eq("id", lessonId);
  await supabase.from("courses").delete().eq("id", courseId);
  await supabase.from("organization_memberships").delete().eq("organization_id", organizationId || "00000000-0000-0000-0000-000000000000");
  await supabase.from("organization_plan_assignments").delete().eq("organization_id", organizationId || "00000000-0000-0000-0000-000000000000");
  await supabase.from("organizations").delete().eq("slug", orgSlug);

  for (const user of [manager, orgLearner, autoLearner, manualLearner].filter(Boolean)) {
    await supabase.auth.admin.deleteUser(user.id);
  }
}

async function seedFixture() {
  manager = await createTestUser(managerEmail, `Org Mission Manager ${runId}`);
  orgLearner = await createTestUser(orgLearnerEmail, `Org Mission Member ${runId}`);
  autoLearner = await createTestUser(autoLearnerEmail, `Org Mission Auto ${runId}`);
  manualLearner = await createTestUser(manualLearnerEmail, `Org Mission Manual ${runId}`);

  const organization = await assertNoError<OrganizationIdRow>(
    await supabase
      .from("organizations")
      .insert({
        slug: orgSlug,
        name: orgName,
        status: "published",
        created_by: manager.id,
      })
      .select("id")
      .single(),
    "create organization",
  );
  if (!organization) {
    throw new Error("create organization returned no row.");
  }
  organizationId = organization.id;

  await assertNoError(
    await supabase.from("organization_plan_assignments").insert({
      organization_id: organizationId,
      plan_key: "team",
      billing_status: "trial",
      assigned_by: manager.id,
    }),
    "assign organization plan",
  );

  await assertNoError(
    await supabase.from("organization_memberships").insert([
      {
        organization_id: organizationId,
        user_id: manager.id,
        role: "programme_manager",
        status: "active",
        invited_by: manager.id,
      },
      {
        organization_id: organizationId,
        user_id: orgLearner.id,
        role: "learner",
        status: "active",
        invited_by: manager.id,
      },
    ]),
    "seed memberships",
  );

  await assertNoError(
    await supabase.from("courses").insert({
      id: courseId,
      slug: courseId,
      title: `E2E Org Mission Course ${runId}`,
      description: "Organisation mission browser coverage course.",
      intended_audience: "Organisation mission learners.",
      learning_outcomes: [`Stay in org mode ${runId}`],
      category: "Institutional",
      level: "beginner",
      status: "published",
      estimated_minutes: 1,
      sort_order: -8_000,
      thumbnail: {},
      catalog_scope: "organization_private",
      organization_id: organizationId,
    }),
    "seed course",
  );

  await assertNoError(
    await supabase.from("lessons").insert({
      id: lessonId,
      course_id: courseId,
      slug: lessonId,
      title: `E2E Org Mission Lesson ${runId}`,
      subtitle: "Mission browser gate",
      description: "A private lesson for organisation mission delivery.",
      status: "published",
      retry_mode: "anytime",
      retry_requires_reread: false,
      quiz_requires_lesson_completion: false,
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
      title: `E2E Org Mission Page ${runId}`,
      subtitle: "Org mode mission",
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
        heading: "Organisation mission delivery",
        body: `Browser coverage for organisation mission delivery ${runId}`,
      },
    }),
    "seed lesson block",
  );

  await assertNoError(
    await supabase.from("programmes").insert({
      id: programmeId,
      organization_id: organizationId,
      title: `E2E Org Mission Programme ${runId}`,
      slug: `e2e-org-mission-programme-${runId}`,
      objective: "Exercise contextual referral mission access.",
      intended_audience: "Contextual referral learners.",
      status: "published",
      schedule_starts_at: null,
      schedule_ends_at: null,
      completion_rules: {},
    }),
    "seed programme",
  );

  await assertNoError(
    await supabase.from("programme_courses").insert({
      programme_id: programmeId,
      course_id: courseId,
      sort_order: 1,
    }),
    "attach course to programme",
  );

  await assertNoError(
    await supabase.from("missions").insert([
      {
        id: orgWideMissionId,
        title: `E2E Organisation-wide Mission ${runId}`,
        description: "Visible to active organisation learners.",
        category: "course",
        reward_type: "xp",
        reward_xp: 10,
        repeatability: "once",
        validation_type: "course_completed",
        validation_config: { courseId },
        status: "published",
        sort_order: -8_000,
        catalog_scope: "organization_private",
        organization_id: organizationId,
        mission_type_key: "course_completed",
        reward_mode: "organization_xp",
        delivery_scope: "catalog_only",
        presentation_config: {
          title: `Org-wide mission copy ${runId}`,
          ctaLabel: "Continue organisation learning",
          successMessage: "Org-wide mission complete",
        },
      },
      {
        id: programmeMissionId,
        title: `E2E Programme Mission ${runId}`,
        description: "Visible only through programme delivery.",
        category: "course",
        reward_type: "xp",
        reward_xp: 15,
        repeatability: "once",
        validation_type: "course_completed",
        validation_config: { courseId },
        status: "published",
        sort_order: -7_999,
        catalog_scope: "organization_private",
        organization_id: organizationId,
        mission_type_key: "course_completed",
        reward_mode: "organization_xp",
        delivery_scope: "catalog_only",
        presentation_config: {
          title: `Programme base mission copy ${runId}`,
          ctaLabel: "Open programme learning",
        },
      },
      {
        id: catalogueMissionId,
        title: `E2E Catalogue-only Mission ${runId}`,
        description: "Managers can maintain this without learner delivery.",
        category: "course",
        reward_type: "xp",
        reward_xp: 5,
        repeatability: "once",
        validation_type: "course_completed",
        validation_config: { courseId },
        status: "published",
        sort_order: -7_998,
        catalog_scope: "organization_private",
        organization_id: organizationId,
        mission_type_key: "course_completed",
        reward_mode: "organization_xp",
        delivery_scope: "catalog_only",
        presentation_config: {},
      },
    ]),
    "seed missions",
  );

  await assertNoError(
    await supabase.from("programme_missions").insert({
      programme_id: programmeId,
      mission_id: programmeMissionId,
      sort_order: 1,
      is_required: true,
      presentation_overrides: {
        title: `Programme override mission copy ${runId}`,
        ctaLabel: "Start programme mission",
        successMessage: "Programme proof accepted",
      },
    }),
    "attach mission to programme",
  );

  await assertNoError(
    await supabase.from("contextual_referral_tokens").insert([
      {
        token: automaticToken,
        referrer_user_id: manager.id,
        organization_id: organizationId,
        programme_id: programmeId,
        programme_mission_id: programmeMissionId,
        destination: `/o/${orgSlug}/learn`,
        eligibility_policy: { enrolmentPolicy: "automatic" },
        presentation_config: { title: "Join automatically" },
        status: "published",
      },
      {
        token: manualToken,
        referrer_user_id: manager.id,
        organization_id: organizationId,
        programme_id: programmeId,
        programme_mission_id: programmeMissionId,
        destination: `/o/${orgSlug}/learn`,
        eligibility_policy: { enrolmentPolicy: "manual_approval" },
        presentation_config: { title: "Request access" },
        status: "published",
      },
    ]),
    "seed contextual referrals",
  );
}

test.describe.serial("organization mission browser acceptance", () => {
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
    await seedFixture();
  });

  test.afterAll(async () => {
    await cleanupFixture();
  });

  test("renders organisation-wide, programme, and manual referral mission journeys", async ({ page }) => {
    await signIn(page, orgLearnerEmail, `/o/${orgSlug}/missions`);
    await expect(page).toHaveURL(new RegExp(`/o/${orgSlug}/missions$`));
    await expect(page.getByText(`Org-wide mission copy ${runId}`)).toHaveCount(0);
    await expect(page.getByText(`Programme override mission copy ${runId}`)).toHaveCount(0);
    await expect(page.getByText(`E2E Catalogue-only Mission ${runId}`)).toHaveCount(0);

    await clearBrowserState(page);
    await signIn(page, managerEmail, `/admin/missions/${orgWideMissionId}`);
    await expect(page.getByRole("heading", { level: 1, name: `E2E Organisation-wide Mission ${runId}` })).toBeVisible();
    await expect(page.locator("input[name='deliveryScope'][value='catalog_only']")).toBeChecked();
    await page.locator("input[name='deliveryScope'][value='organization']").check();
    await page.getByRole("button", { name: "Save mission" }).click();
    await expect(page.getByText("Organisation mission saved.")).toBeVisible();

    await clearBrowserState(page);
    await signIn(page, orgLearnerEmail, `/o/${orgSlug}/missions`);
    await expect(page).toHaveURL(new RegExp(`/o/${orgSlug}/missions$`));
    await expect(page.getByText(`Org-wide mission copy ${runId}`)).toBeVisible();
    await expect(page.getByText(`Programme override mission copy ${runId}`)).toHaveCount(0);
    await expect(page.getByText(`E2E Catalogue-only Mission ${runId}`)).toHaveCount(0);

    await clearBrowserState(page);
    await signIn(
      page,
      autoLearnerEmail,
      `/login?next=${encodeURIComponent(`/o/${orgSlug}/learn`)}&ref=${automaticToken}&refKind=contextual`,
    );
    await expect(page).toHaveURL(new RegExp(`/o/${orgSlug}/learn$`));
    await page.goto(`/o/${orgSlug}/missions`);
    await expect(page.getByText(`Programme override mission copy ${runId}`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Start programme mission" })).toHaveAttribute(
      "href",
      `/o/${orgSlug}/learn`,
    );

    await clearBrowserState(page);
    await signIn(
      page,
      manualLearnerEmail,
      `/login?next=${encodeURIComponent(`/o/${orgSlug}/learn`)}&ref=${manualToken}&refKind=contextual`,
    );
    await expect(page).toHaveURL(/\/org\/my\?notice=/);
    await expect(page.getByText(/Access requested/i)).toBeVisible();

    const pendingEnrolment = await assertNoError<PendingEnrolmentRow>(
      await supabase
        .from("enrolments")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("programme_id", programmeId)
        .eq("user_id", manualLearner.id)
        .single(),
      "load pending manual enrolment",
    );
    if (!pendingEnrolment) {
      throw new Error("Manual referral did not create a pending enrolment.");
    }
    expect(pendingEnrolment.status).toBe("pending");

    await clearBrowserState(page);
    await signIn(page, managerEmail, `/admin/programmes/${programmeId}`);
    await expect(page.getByRole("heading", { level: 1, name: `E2E Org Mission Programme ${runId}` })).toBeVisible();
    await expect(page.getByText("Pending access requests")).toBeVisible();
    await expect(page.getByText(`Org Mission Manual ${runId}`)).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Access request approved.")).toBeVisible();

    await clearBrowserState(page);
    await signIn(
      page,
      manualLearnerEmail,
      `/login?next=${encodeURIComponent(`/o/${orgSlug}/learn`)}&ref=${manualToken}&refKind=contextual`,
    );
    await expect(page).toHaveURL(new RegExp(`/o/${orgSlug}/learn$`));
    await page.goto(`/o/${orgSlug}/missions`);
    await expect(page.getByText(`Programme override mission copy ${runId}`)).toBeVisible();
  });
});
