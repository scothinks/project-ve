import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const fixture = {
  email: "a13-m2-learner@example.test",
  organizationSlug: "a13-m2-police-academy",
  organizationName: "Metropolitan Police Academy",
  organizationShortName: "Met Police Academy",
  programmeSlug: "frontline-ethics",
  programmeTitle: "Frontline Ethics Programme",
  assessmentTitle: "Ethics in Action",
};
const reviewPassword = process.env.A13_M2_REVIEW_PASSWORD;

if (!reviewPassword) {
  throw new Error("A13_M2_REVIEW_PASSWORD is required for local fixture seeding.");
}

function parseEnvOutput(output) {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

function readLocalSupabaseEnv() {
  const result = spawnSync(
    process.execPath,
    ["scripts/supabase-cli.mjs", "status", "-o", "env"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    return {};
  }

  return parseEnvOutput(result.stdout);
}

function required(value, label) {
  if (!value) {
    throw new Error(`${label} is required. Run npm run db:start first.`);
  }
  return value;
}

const statusEnv = readLocalSupabaseEnv();
const supabaseUrl = process.env.LOCAL_SUPABASE_URL ?? statusEnv.API_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = required(
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? statusEnv.SERVICE_ROLE_KEY,
  "Local Supabase service role key",
);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function upsert(table, values, options) {
  const { data, error } = await supabase
    .from(table)
    .upsert(values, options)
    .select();

  if (error) {
    throw new Error(`${table} upsert failed: ${error.message}`);
  }

  return data;
}

async function remove(table, match) {
  let query = supabase.from(table).delete();
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }
  const { error } = await query;
  if (error) {
    throw new Error(`${table} delete failed: ${error.message}`);
  }
}

async function getOrCreateUser() {
  let page = 1;
  let existing = null;

  while (!existing) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw error;
    }
    existing = data.users.find((user) => user.email?.toLowerCase() === fixture.email);
    if (existing || data.users.length < 100) {
      break;
    }
    page += 1;
  }

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password: reviewPassword,
      user_metadata: { full_name: "Alex" },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: fixture.email,
    password: reviewPassword,
    email_confirm: true,
    user_metadata: { full_name: "Alex" },
  });
  if (error) throw error;
  return data.user;
}

async function seedValueDimensions() {
  await upsert(
    "value_dimensions",
    [
      {
        id: "integrity",
        label: "Integrity",
        description: "Acting consistently with duty and public trust.",
        sort_order: 10,
        status: "active",
      },
      {
        id: "critical_judgment",
        label: "Critical Judgment",
        description: "Slowing down to assess context and bias before acting.",
        sort_order: 20,
        status: "active",
      },
      {
        id: "community_action",
        label: "Community Action",
        description: "Building trust through transparent, accountable action.",
        sort_order: 30,
        status: "active",
      },
    ],
    { onConflict: "id" },
  );
}

async function seedOrganization(userId) {
  const [organization] = await upsert(
    "organizations",
    {
      slug: fixture.organizationSlug,
      name: fixture.organizationName,
      short_name: fixture.organizationShortName,
      description: "Local-only A13/M2 screenshot fixture.",
      status: "published",
      lifecycle_status: "active",
      verification_status: "verified",
      accent_token: "green",
      created_by: userId,
    },
    { onConflict: "slug" },
  );

  await supabase
    .from("organization_plan_assignments")
    .update({ ended_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("organization_id", organization.id)
    .is("ended_at", null);

  const { error: planInsertError } = await supabase
    .from("organization_plan_assignments")
    .insert({
      organization_id: organization.id,
      plan_key: "team",
      billing_status: "free",
      assigned_by: userId,
      starts_at: new Date().toISOString(),
    });

  if (planInsertError) {
    throw new Error(`organization_plan_assignments insert failed: ${planInsertError.message}`);
  }

  await upsert(
    "organization_memberships",
    {
      organization_id: organization.id,
      user_id: userId,
      role: "learner",
      status: "active",
    },
    { onConflict: "organization_id,user_id,role" },
  );

  const { data: xpAccount, error: xpAccountError } = await supabase
    .from("xp_accounts")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("scope", "organization")
    .eq("is_default", true)
    .eq("status", "active")
    .maybeSingle();

  if (xpAccountError || !xpAccount) {
    throw new Error(`Default XP account missing: ${xpAccountError?.message ?? "not found"}`);
  }

  const { error: xpUpdateError } = await supabase
    .from("xp_accounts")
    .update({
      name: "Police Points",
      plural_name: "Police Points",
      display_name: "Police Point",
      display_name_plural: "Police Points",
      short_label: "pts",
      display_format: "amount_name",
    })
    .eq("id", xpAccount.id);

  if (xpUpdateError) {
    throw new Error(`XP account update failed: ${xpUpdateError.message}`);
  }

  await upsert(
    "user_xp_balances",
    {
      user_id: userId,
      xp_account_id: xpAccount.id,
      balance_cached: 1250,
    },
    { onConflict: "user_id,xp_account_id" },
  );

  return { organization, xpAccountId: xpAccount.id };
}

async function seedCourses(organizationId) {
  const courses = [
    {
      id: "a13-m2-procedural-justice",
      slug: "a13-m2-procedural-justice",
      title: "Procedural Justice",
      description: "Practice clear explanations, neutral decision making, and respectful engagement in frontline encounters.",
      category: "Ethics",
      level: "beginner",
      thumbnail: {
        src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
        alt: "Officers reviewing a training brief at a table",
      },
      status: "published",
      sort_order: 10,
      estimated_minutes: 35,
      catalog_scope: "organization_private",
      organization_id: organizationId,
      intended_audience: "Learners preparing for frontline public trust scenarios.",
      learning_outcomes: [
        "Explain decisions using plain-language procedural justice steps.",
        "Identify moments where neutral reasoning should be documented.",
      ],
    },
    {
      id: "a13-m2-de-escalation",
      slug: "a13-m2-de-escalation",
      title: "De-escalation Tactics",
      description: "Master de-escalation techniques and active listening for high-pressure field encounters.",
      category: "Practice",
      level: "beginner",
      thumbnail: {
        src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80",
        alt: "A small group discussing a scenario in training",
      },
      status: "published",
      sort_order: 20,
      estimated_minutes: 25,
      catalog_scope: "organization_private",
      organization_id: organizationId,
      intended_audience: "Learners preparing for public interaction scenarios.",
      learning_outcomes: [
        "Recognize early escalation signals.",
        "Choose communication options that preserve safety and dignity.",
      ],
    },
  ];

  await upsert("courses", courses, { onConflict: "id" });

  const lessons = [
    ["a13-m2-pj-lesson-1", "a13-m2-procedural-justice", "explain-the-why", "Explain the Why", "Use clear reasoning before giving an instruction.", 1, 8],
    ["a13-m2-pj-lesson-2", "a13-m2-procedural-justice", "neutral-decision-log", "Neutral Decision Log", "Capture relevant facts before drawing conclusions.", 2, 10],
    ["a13-m2-pj-lesson-3", "a13-m2-procedural-justice", "respectful-close", "Respectful Close", "Close encounters with transparency and next steps.", 3, 9],
    ["a13-m2-de-lesson-1", "a13-m2-de-escalation", "tactical-communications", "Tactical Communications", "Master de-escalation techniques and active listening.", 1, 12],
    ["a13-m2-de-lesson-2", "a13-m2-de-escalation", "respectful-treatment", "Respectful Treatment", "De-escalation through dignified interaction.", 2, 8],
  ].map(([id, course_id, slug, title, subtitle, sort_order, estimated_minutes]) => ({
    id,
    course_id,
    slug,
    title,
    subtitle,
    description: subtitle,
    status: "published",
    sort_order,
    estimated_minutes,
    cover_image: {
      src: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
      alt: "Training notes and a laptop on a table",
    },
  }));

  await upsert("lessons", lessons, { onConflict: "id" });

  const pages = lessons.flatMap((lesson) => [
    {
      id: `${lesson.id}-page-1`,
      lesson_id: lesson.id,
      page_number: 1,
      title: lesson.title,
      subtitle: lesson.subtitle,
      page_type: "concept",
    },
    {
      id: `${lesson.id}-page-2`,
      lesson_id: lesson.id,
      page_number: 2,
      title: "Apply the scenario",
      subtitle: "Pick one step you can use in the next shift.",
      page_type: "reflection",
    },
  ]);

  await upsert("lesson_pages", pages, { onConflict: "id" });

  await upsert(
    "lesson_content_blocks",
    pages.flatMap((page) => [
      {
        page_id: page.id,
        sort_order: 1,
        block_type: "text",
        payload: {
          body: "Use this short scenario to connect the principle to a concrete frontline decision.",
        },
      },
    ]),
    { onConflict: "page_id,sort_order" },
  );

  await upsert(
    "content_value_tags",
    [
      {
        content_type: "course",
        content_id: "a13-m2-procedural-justice",
        dimension_id: "integrity",
        weight: 0.9,
        recommended_level: "beginner",
        outcome_type: "practice",
      },
      {
        content_type: "lesson",
        content_id: "a13-m2-pj-lesson-2",
        dimension_id: "critical_judgment",
        weight: 0.85,
        recommended_level: "beginner",
        outcome_type: "reflection",
      },
      {
        content_type: "course",
        content_id: "a13-m2-de-escalation",
        dimension_id: "community_action",
        weight: 0.75,
        recommended_level: "beginner",
        outcome_type: "practice",
      },
    ],
    { onConflict: "content_type,content_id,dimension_id" },
  );
}

async function seedProgramme({ organizationId, userId, xpAccountId }) {
  const [programme] = await upsert(
    "programmes",
    {
      organization_id: organizationId,
      slug: fixture.programmeSlug,
      title: fixture.programmeTitle,
      objective: "Build ethical decision-making habits for frontline public interactions.",
      intended_audience: "New and returning frontline learners.",
      status: "published",
      default_xp_account_id: xpAccountId,
      created_by: userId,
    },
    { onConflict: "organization_id,slug" },
  );

  await upsert(
    "programme_courses",
    [
      {
        programme_id: programme.id,
        course_id: "a13-m2-procedural-justice",
        sort_order: 1,
        requirement: "required",
        prior_completion_policy: "require_completion_in_context",
      },
      {
        programme_id: programme.id,
        course_id: "a13-m2-de-escalation",
        sort_order: 2,
        requirement: "optional",
        prior_completion_policy: "require_completion_in_context",
      },
    ],
    { onConflict: "programme_id,course_id" },
  );

  await remove("enrolments", {
    organization_id: organizationId,
    user_id: userId,
    programme_id: programme.id,
  });

  const { error: enrolmentError } = await supabase.from("enrolments").insert({
    organization_id: organizationId,
    user_id: userId,
    course_id: null,
    programme_id: programme.id,
    assignment_source: "manual",
    status: "active",
    started_at: new Date(Date.now() - 86_400_000).toISOString(),
    xp_account_id: xpAccountId,
    metadata: { fixture: "anchor-13c-m2" },
  });

  if (enrolmentError) {
    throw new Error(`enrolments insert failed: ${enrolmentError.message}`);
  }

  return programme;
}

async function seedAssessment({ programmeId, xpAccountId }) {
  const slug = `a13-m2-ethics-in-action-${Date.now()}`;
  const [assessment] = await upsert(
    "assessment_versions",
    {
      slug,
      title: fixture.assessmentTitle,
      description: "A short ethics checkpoint for your organization learning plan.",
      xp_award: 50,
      status: "draft",
      owner_scope: "platform",
      organization_id: null,
      introduction_copy: "Answer a few scenario questions before continuing your programme.",
      completion_copy: "Your learning recommendations have been tuned for your ethics profile.",
      scoring_config: {},
      published_at: null,
    },
    { onConflict: "slug" },
  );

  const prompts = [
    "A resident challenges why they were stopped. What should you do first?",
    "Two reports conflict during a handover. What is the strongest next step?",
    "You observe a colleague accepting a small, seemingly insignificant gift from a vendor during a routine patrol. The departmental policy strictly prohibits accepting gifts of any value. What is your immediate course of action?",
    "A tense conversation is beginning to calm. What closes the interaction best?",
    "A partner uses dismissive language after a stressful call. What is the best response?",
    "You notice a report omits context that could affect the decision. What should happen next?",
    "A community member asks how a decision was made. What should guide your reply?",
    "A routine stop starts drawing a crowd. What should you prioritize?",
    "A supervisor asks for a quick update before facts are checked. What is your response?",
    "A colleague asks you to overlook a small policy miss. What should you do?",
  ];

  const questions = [];
  const options = [];
  const weights = [];

  for (const [questionIndex, prompt] of prompts.entries()) {
    const { data: questionRows, error: questionError } = await supabase
      .from("assessment_questions")
      .insert({
        assessment_version_id: assessment.id,
        prompt,
        helper_text: "Choose the response that best protects trust and accountability.",
        question_type: "single_select",
        sort_order: questionIndex + 1,
      })
      .select();

    if (questionError) throw new Error(`assessment question insert failed: ${questionError.message}`);
    const question = questionRows[0];
    questions.push(question);

    for (const [optionIndex, option] of [
      ["Ignore the interaction as it was a small gift and confronting them might damage unit cohesion.", "Avoids immediate conflict but leaves the policy breach unresolved."],
      ["Confront the colleague privately, reminding them of the policy, and urge them to return the gift immediately.", "Addresses the issue directly while preserving dignity."],
      ["Document the incident thoroughly and report it directly to your immediate supervisor without discussing it with the colleague.", "Creates a formal record for leadership review."],
    ].entries()) {
      const { data: optionRows, error: optionError } = await supabase
        .from("assessment_question_options")
        .insert({
          question_id: question.id,
          label: option[0],
          description: option[1],
          sort_order: optionIndex + 1,
        })
        .select();

      if (optionError) throw new Error(`assessment option insert failed: ${optionError.message}`);
      const optionRow = optionRows[0];
      options.push(optionRow);
      weights.push({
        option_id: optionRow.id,
        dimension_id: optionIndex === 1 ? "critical_judgment" : optionIndex === 2 ? "community_action" : "integrity",
        weight: optionIndex === 2 ? 0.35 : 0.9,
      });
    }
  }

  await upsert("assessment_option_dimension_weights", weights, {
    onConflict: "option_id,dimension_id",
  });

  const { error: publishError } = await supabase
    .from("assessment_versions")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", assessment.id);

  if (publishError) {
    throw new Error(`assessment publish failed: ${publishError.message}`);
  }

  await remove("programme_assessments", {
    programme_id: programmeId,
  });

  await upsert(
    "programme_assessments",
    {
      programme_id: programmeId,
      assessment_version_id: assessment.id,
      sort_order: 1,
      xp_account_id: xpAccountId,
      is_required: true,
      introduction_copy: "Complete this checkpoint to unlock tailored next learning.",
      completion_copy: "Your ethics profile is complete. Review the next learning recommended by the academy.",
      delivery_config: { estimatedMinutes: 2, mobileSlice: "A13-51/A13-52/A13-53" },
    },
    { onConflict: "programme_id,assessment_version_id" },
  );

  return { assessment, questions, options };
}

async function seedInitialProgress({ programmeId, userId }) {
  const fixtureLessonIds = [
    "a13-m2-pj-lesson-1",
    "a13-m2-pj-lesson-2",
    "a13-m2-pj-lesson-3",
    "a13-m2-de-lesson-1",
    "a13-m2-de-lesson-2",
  ];

  const { error: progressDeleteError } = await supabase
    .from("lesson_progress")
    .delete()
    .eq("user_id", userId)
    .in("lesson_id", fixtureLessonIds);

  if (progressDeleteError) {
    throw new Error(`lesson progress reset failed: ${progressDeleteError.message}`);
  }

  const { error: programmeProgressDeleteError } = await supabase
    .from("programme_lesson_page_completions")
    .delete()
    .eq("user_id", userId)
    .eq("programme_id", programmeId)
    .in("lesson_id", fixtureLessonIds);

  if (programmeProgressDeleteError) {
    throw new Error(`programme completion reset failed: ${programmeProgressDeleteError.message}`);
  }

  const proceduralJusticePageIds = ["a13-m2-pj-lesson-1-page-1", "a13-m2-pj-lesson-1-page-2"];
  const deEscalationPageIds = ["a13-m2-de-lesson-1-page-1", "a13-m2-de-lesson-1-page-2"];

  await upsert(
    "lesson_progress",
    [
      {
        user_id: userId,
        lesson_id: "a13-m2-pj-lesson-1",
        completed_pages: proceduralJusticePageIds,
        completed_modules: proceduralJusticePageIds,
        completed_at: new Date(Date.now() - 3_600_000).toISOString(),
      },
      {
        user_id: userId,
        lesson_id: "a13-m2-de-lesson-1",
        completed_pages: deEscalationPageIds,
        completed_modules: deEscalationPageIds,
        completed_at: new Date(Date.now() - 1_800_000).toISOString(),
      },
    ],
    { onConflict: "user_id,lesson_id" },
  );

  await upsert(
    "programme_lesson_page_completions",
    [
      ...proceduralJusticePageIds.map((pageId) => ({
        user_id: userId,
        programme_id: programmeId,
        lesson_id: "a13-m2-pj-lesson-1",
        page_id: pageId,
        completed_at: new Date(Date.now() - 3_600_000).toISOString(),
      })),
      ...deEscalationPageIds.map((pageId) => ({
        user_id: userId,
        programme_id: programmeId,
        lesson_id: "a13-m2-de-lesson-1",
        page_id: pageId,
        completed_at: new Date(Date.now() - 1_800_000).toISOString(),
      })),
    ],
    { onConflict: "user_id,programme_id,lesson_id,page_id" },
  );
}

async function main() {
  await seedValueDimensions();
  const user = await getOrCreateUser();

  await upsert(
    "profiles",
    {
      id: user.id,
      display_name: "Alex",
      role: "learner",
      xp: 1250,
      xp_balance_cached: 1250,
    },
    { onConflict: "id" },
  );

  const { organization, xpAccountId } = await seedOrganization(user.id);
  await remove("user_value_profiles", {
    user_id: user.id,
    context_scope: "organization",
    organization_id: organization.id,
  });
  await remove("user_value_dimension_scores", {
    user_id: user.id,
    context_scope: "organization",
    organization_id: organization.id,
  });
  await seedCourses(organization.id);
  const programme = await seedProgramme({
    organizationId: organization.id,
    userId: user.id,
    xpAccountId,
  });
  const { assessment } = await seedAssessment({
    programmeId: programme.id,
    xpAccountId,
  });
  await remove("user_assessment_attempts", {
    user_id: user.id,
    assessment_version_id: assessment.id,
  });
  await seedInitialProgress({ programmeId: programme.id, userId: user.id });

  console.log(JSON.stringify({
    assessmentId: assessment.id,
    email: fixture.email,
    organizationId: organization.id,
    programmeId: programme.id,
    slug: fixture.organizationSlug,
    supabaseUrl,
    userId: user.id,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
