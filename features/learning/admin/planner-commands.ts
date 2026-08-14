import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCourseExpansionPlanForm } from "@/lib/admin-ai-validation";
import {
  generateCourseExpansionPlans,
  generateNewCoursePlans,
} from "@/lib/ai-course-planner";
import {
  parseStoredCourseExpansionPlan,
  parseStoredNewCoursePlan,
  type NewCoursePlanInput,
  type NewCoursePlanOption,
} from "@/features/learning/admin/planner-model";
import { getAiLearningConfig } from "@/lib/ai-learning-generator";
import { logAppError } from "@/lib/app-errors";
import type { AdminContext } from "@/features/admin/application/context";
import {
  buildOrganizationAiIdempotencyKey,
  estimatePlannerUnits,
  getAdminWorkspaceOrganizationId,
  getCourseOrganizationId,
  reconcileOrganizationAiUsage,
  reserveOrganizationAiUsage,
  type OrganizationAiReservation,
} from "@/features/ai-generation/application/organization-ai-metering";
import {
  asString,
  buildExpansionContinuityInstruction,
  buildExpansionDraftNotes,
  buildPlannedLessonsContinuityInstruction,
  buildPlannedLessonsNotes,
  buildSelectedCourseNotes,
  buildSelectedPlanSelection,
  buildUrl,
  clampInteger,
  createTextId,
  getRecommendedQuestionCount,
  getSelectedNewCourseOptionFromForm,
  getSelectedNewCoursePlanSelection,
  logInvalidPlannerRecord,
  mergeNewCourseOptionEdits,
  parseInteger,
  parseNewCoursePlanInput,
  requireValidPlannerForm,
  slugify,
} from "./planner-domain";
import { getCourseExpansionContext, getPlannerPlan } from "./planner-data";

export type PlannerCommandResult = {
  courseId: string | null;
  returnPath: string;
  notice: string;
};

export type PlannerAiGenerationHandoff = {
  courseId: string | null;
  draftFormData: FormData;
};

export type PlannerMaybeHandoffResult = PlannerCommandResult | PlannerAiGenerationHandoff;

function buildCourseShellGenerationNotes(
  input: NewCoursePlanInput,
  option: NewCoursePlanOption,
  planId: string,
) {
  const config = getAiLearningConfig();

  return {
    source: "openai",
    mode: "planner_course_shell",
    plannerPlanId: planId,
    plannerStage: "course_shell",
    textModel: config.textModel,
    reviewModel: config.reviewModel,
    generatedFrom: {
      topic: option.title || input.roughIdea,
      audience: option.targetAudience || input.audience,
      region: input.region,
      difficulty: option.level,
      tone: option.tone || input.tone,
      notes: buildSelectedCourseNotes(input, option),
    },
    selectedBrief: option,
    lessonCount: option.lessonOutline.length,
  };
}

function buildSelectedCourseDraftFormData(
  input: NewCoursePlanInput,
  option: NewCoursePlanOption,
) {
  const draftFormData = new FormData();
  draftFormData.set("topic", option.title || input.roughIdea);
  draftFormData.set("audience", option.targetAudience || input.audience);
  draftFormData.set("region", input.region);
  draftFormData.set("difficulty", option.level);
  draftFormData.set("tone", option.tone || input.tone);
  draftFormData.set("lessonCount", String(clampInteger(option.lessonOutline.length, 1, 8)));
  draftFormData.set("questionsPerLesson", String(getRecommendedQuestionCount(option.level)));
  draftFormData.set("notes", buildSelectedCourseNotes(input, option));

  return draftFormData;
}

function buildPlannedLessonsDraftFormData(
  input: NewCoursePlanInput,
  option: NewCoursePlanOption,
  courseId: string,
) {
  const draftFormData = new FormData();
  draftFormData.set("courseId", courseId);
  draftFormData.set("topic", option.title || input.roughIdea);
  draftFormData.set("audience", option.targetAudience || input.audience);
  draftFormData.set("region", input.region);
  draftFormData.set("difficulty", option.level);
  draftFormData.set("tone", option.tone || input.tone);
  draftFormData.set("lessonCount", String(clampInteger(option.lessonOutline.length, 1, 10)));
  draftFormData.set("questionsPerLesson", String(getRecommendedQuestionCount(option.level)));
  draftFormData.set("notes", buildPlannedLessonsNotes(input, option));
  draftFormData.set("continuityInstruction", buildPlannedLessonsContinuityInstruction(option));

  return draftFormData;
}

export async function generateNewCoursePlanOptionsCommand(
  admin: AdminContext,
  formData: FormData,
): Promise<PlannerCommandResult> {
  const { supabase, profile } = admin;
  const input = parseNewCoursePlanInput(formData);

  if (!input.roughIdea || !input.audience || !input.region || !input.tone) {
    throw new Error("Rough idea, audience, region, and tone are required.");
  }

  const operationType = "ai_planner_new_course";
  const organizationId = getAdminWorkspaceOrganizationId(admin);
  const estimatedUnits = estimatePlannerUnits(operationType, 3);
  const idempotencyKey = buildOrganizationAiIdempotencyKey(profile.id, operationType, {
    input,
  });
  let reservation: OrganizationAiReservation | null = null;
  let result: Awaited<ReturnType<typeof generateNewCoursePlans>>;

  try {
    reservation = await reserveOrganizationAiUsage(supabase, {
      actorUserId: profile.id,
      estimatedUnits,
      idempotencyKey,
      metadata: { plannerMode: "new_course" },
      operationType,
      organizationId,
      sourceId: idempotencyKey,
      sourceType: "ai_course_plan",
    });
    result = await generateNewCoursePlans(input);
  } catch (error) {
    await reconcileOrganizationAiUsage(supabase, reservation, {
      failedJobChargePolicy: "release_failed_planner_call_without_provider_usage",
      failureCode: "planner_generation_failed",
      status: "released",
    }).catch((reconcileError) => {
      logAppError(reconcileError, {
        operation: "admin.ai_planner.new_course.release_reservation",
        resourceId: reservation?.usageRecordId,
      });
    });
    throw error;
  }

  const { data, error } = await supabase
    .from("ai_course_plans")
    .insert({
      mode: "new_course",
      course_id: null,
      status: "draft",
      input_prompt: [
        `Rough idea: ${input.roughIdea}`,
        `Audience: ${input.audience}`,
        `Region: ${input.region}`,
        `Level: ${input.level}`,
        `Tone: ${input.tone}`,
        input.notes ? `Notes: ${input.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      generated_plan: {
        input,
        result,
      },
      selected_items: [],
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    await reconcileOrganizationAiUsage(supabase, reservation, {
      failedJobChargePolicy: "charge_reserved_estimate_after_provider_success_and_persistence_failure",
      failureCode: "planner_persistence_failed",
      finalChargedUnits: estimatedUnits,
      metadata: { plannerMode: "new_course" },
      status: "charged",
    });
    throw error;
  }
  const plan = data as { id: string };
  await reconcileOrganizationAiUsage(supabase, reservation, {
    finalChargedUnits: estimatedUnits,
    metadata: { planId: plan.id },
    status: "charged",
  });

  return {
    courseId: null,
    returnPath: buildUrl("/admin/courses/ai/planner", { plan: plan.id }),
    notice: "Three AI course brief options are ready.",
  };
}

export async function generateCourseExpansionPlanCommand(
  admin: AdminContext,
  formData: FormData,
): Promise<PlannerCommandResult> {
  const { supabase, profile } = admin;
  const {
    courseId,
    expansionGoal,
    notes,
    numberOfSuggestions,
  } = requireValidPlannerForm(parseCourseExpansionPlanForm(formData));

  if (!courseId) {
    throw new Error("Select a course to expand.");
  }

  const context = await getCourseExpansionContext(
    supabase,
    courseId,
    expansionGoal,
    numberOfSuggestions,
    notes,
  );
  const operationType = "ai_planner_expand_course";
  const organizationId = await getCourseOrganizationId(supabase, courseId);
  const estimatedUnits = estimatePlannerUnits(operationType, numberOfSuggestions);
  const idempotencyKey = buildOrganizationAiIdempotencyKey(profile.id, operationType, {
    courseId,
    expansionGoal,
    notes,
    numberOfSuggestions,
  });
  let reservation: OrganizationAiReservation | null = null;
  let result: Awaited<ReturnType<typeof generateCourseExpansionPlans>>;

  try {
    reservation = await reserveOrganizationAiUsage(supabase, {
      actorUserId: profile.id,
      courseId,
      estimatedUnits,
      idempotencyKey,
      metadata: { plannerMode: "expand_course" },
      operationType,
      organizationId,
      sourceId: idempotencyKey,
      sourceType: "ai_course_plan",
    });
    result = await generateCourseExpansionPlans(context);
  } catch (error) {
    await reconcileOrganizationAiUsage(supabase, reservation, {
      failedJobChargePolicy: "release_failed_planner_call_without_provider_usage",
      failureCode: "planner_generation_failed",
      status: "released",
    }).catch((reconcileError) => {
      logAppError(reconcileError, {
        operation: "admin.ai_planner.expand_course.release_reservation",
        resourceId: reservation?.usageRecordId,
      });
    });
    throw error;
  }

  const { data, error } = await supabase
    .from("ai_course_plans")
    .insert({
      mode: "expand_course",
      course_id: courseId,
      status: "draft",
      input_prompt: [
        `Course: ${context.courseTitle}`,
        `Expansion goal: ${context.expansionGoal}`,
        `Suggestions requested: ${context.numberOfSuggestions}`,
        notes ? `Notes: ${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      generated_plan: {
        input: context,
        result,
      },
      selected_items: [],
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    await reconcileOrganizationAiUsage(supabase, reservation, {
      failedJobChargePolicy: "charge_reserved_estimate_after_provider_success_and_persistence_failure",
      failureCode: "planner_persistence_failed",
      finalChargedUnits: estimatedUnits,
      metadata: { plannerMode: "expand_course" },
      status: "charged",
    });
    throw error;
  }
  const plan = data as { id: string };
  await reconcileOrganizationAiUsage(supabase, reservation, {
    finalChargedUnits: estimatedUnits,
    metadata: { planId: plan.id },
    status: "charged",
  });

  return {
    courseId,
    returnPath: buildUrl("/admin/courses/ai/planner", { courseId, plan: plan.id }),
    notice: "AI expansion suggestions are ready.",
  };
}

export async function selectCoursePlanOptionCommand(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<PlannerCommandResult> {
  const planId = asString(formData.get("planId"), 120);
  const optionIndex = parseInteger(formData.get("optionIndex"), 0);
  const suggestionIndex = parseInteger(formData.get("suggestionIndex"), -1);
  const returnPath = asString(
    formData.get("redirectTo"),
    400,
    "/admin/courses/ai/planner",
  );

  const plan = await getPlannerPlan(supabase, planId);

  if (plan.mode === "new_course") {
    const stored = parseStoredNewCoursePlan(plan.generated_plan);
    if (!stored) {
      logInvalidPlannerRecord("admin.course_planner.new_course_plan.parse", plan);
      throw new Error("The saved course brief is invalid.");
    }

    const baseOption = stored.result.options[optionIndex];
    if (!baseOption) {
      throw new Error("Selected brief option not found.");
    }

    const selectedOption = mergeNewCourseOptionEdits(formData, baseOption);
    const { error } = await supabase
      .from("ai_course_plans")
      .update({
        status: "selected",
        selected_items: [selectedOption],
      })
      .eq("id", planId);

    if (error) throw error;

    return {
      courseId: plan.course_id,
      returnPath,
      notice: "Course brief saved for drafting.",
    };
  }

  const stored = parseStoredCourseExpansionPlan(plan.generated_plan);
  if (!stored) {
    logInvalidPlannerRecord("admin.course_planner.expansion_plan.parse", plan);
    throw new Error("The saved expansion plan is invalid.");
  }

  const suggestion = stored.result.lessonSuggestions[suggestionIndex];
  if (!suggestion) {
    throw new Error("Selected lesson suggestion not found.");
  }

  const existingSelections = Array.isArray(plan.selected_items) ? plan.selected_items : [];
  const nextSelections = [...existingSelections, suggestion];
  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "selected",
      selected_items: nextSelections,
    })
    .eq("id", planId);

  if (error) throw error;

  return {
    courseId: plan.course_id,
    returnPath,
    notice: "Lesson suggestion saved.",
  };
}

export async function saveSelectedNewCourseBriefCommand(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<PlannerCommandResult> {
  const planId = asString(formData.get("planId"), 120);
  const returnPath = asString(
    formData.get("redirectTo"),
    400,
    "/admin/courses/ai/planner",
  );
  const plan = await getPlannerPlan(supabase, planId);

  if (plan.mode !== "new_course") {
    throw new Error("This action only supports new course plans.");
  }

  const { selectedOption } = getSelectedNewCourseOptionFromForm(plan, formData);
  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "selected",
      selected_items: [selectedOption],
    })
    .eq("id", planId);

  if (error) throw error;

  return {
    courseId: plan.course_id,
    returnPath,
    notice: "Course brief saved for drafting.",
  };
}

export async function generateCourseFromSelectedPlanCommand(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<PlannerAiGenerationHandoff> {
  const planId = asString(formData.get("planId"), 120);
  const plan = await getPlannerPlan(supabase, planId);
  const { stored, selectedOption } = getSelectedNewCourseOptionFromForm(plan, formData);
  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "used",
      selected_items: [selectedOption],
    })
    .eq("id", planId);

  if (error) throw error;

  return {
    courseId: null,
    draftFormData: buildSelectedCourseDraftFormData(stored.input, selectedOption),
  };
}

export async function generateCourseShellFromSelectedPlanCommand(
  { supabase, profile }: AdminContext,
  formData: FormData,
): Promise<PlannerCommandResult> {
  const planId = asString(formData.get("planId"), 120);
  const plan = await getPlannerPlan(supabase, planId);

  if (plan.mode !== "new_course") {
    throw new Error("This action only supports new course plans.");
  }

  const { stored, selectedOption } = getSelectedNewCourseOptionFromForm(plan, formData);
  const existingSelection = getSelectedNewCoursePlanSelection(plan);

  if (existingSelection?.generatedCourseId) {
    return {
      courseId: existingSelection.generatedCourseId,
      returnPath: `/admin/courses/${existingSelection.generatedCourseId}`,
      notice: "This planner brief already has a generated course setup.",
    };
  }

  const courseId = createTextId("course", selectedOption.title || stored.input.roughIdea);
  const courseSlug = `${slugify(selectedOption.title || stored.input.roughIdea)}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
  const now = new Date().toISOString();
  const courseRow = {
    id: courseId,
    slug: courseSlug,
    title: selectedOption.title,
    description: selectedOption.description,
    intended_audience: selectedOption.targetAudience || stored.input.audience,
    learning_outcomes: selectedOption.learningObjectives,
    category: "Values Education",
    level: selectedOption.level,
    thumbnail: {},
    status: "draft",
    sort_order: 0,
    estimated_minutes: 0,
    ai_text_status: "draft",
    ai_media_status: "not_started",
    ai_publish_status: "not_ready",
    ai_generated: true,
    ai_generation_notes: buildCourseShellGenerationNotes(stored.input, selectedOption, planId),
  };

  const mediaRows = [
    {
      course_id: courseId,
      lesson_id: null,
      asset_type: "cover",
      placement: "course_cover",
      source: "ai_generated",
      prompt: `${selectedOption.mediaStyle}. Course cover for "${selectedOption.title}". ${selectedOption.description}`,
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${selectedOption.title} course cover illustration`,
      caption: selectedOption.title,
      metadata: {
        plannerPlanId: planId,
        required: false,
        targetKind: "course_cover",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: 0,
    },
    {
      course_id: courseId,
      lesson_id: null,
      asset_type: "thumbnail",
      placement: "course_thumbnail",
      source: "ai_generated",
      prompt: `${selectedOption.mediaStyle}. Mobile-friendly course thumbnail for "${selectedOption.title}". ${selectedOption.description}`,
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${selectedOption.title} course thumbnail`,
      caption: selectedOption.title,
      metadata: {
        plannerPlanId: planId,
        required: true,
        targetKind: "course_thumbnail",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: 1,
    },
  ];

  try {
    const { error: courseError } = await supabase.from("courses").insert(courseRow);
    if (courseError) throw courseError;

    const { error: mediaError } = await supabase.from("learning_media_assets").insert(mediaRows);
    if (mediaError) throw mediaError;

    const { error: auditError } = await supabase.from("audit_events").insert({
      actor_user_id: profile.id,
      event_type: "ai_course_shell_generated",
      entity_type: "course",
      entity_id: courseId,
      metadata: {
        plannerPlanId: planId,
        selectedBriefTitle: selectedOption.title,
        lessonCountPlanned: selectedOption.lessonOutline.length,
      },
    });
    if (auditError) throw auditError;

    const nextSelection = buildSelectedPlanSelection(selectedOption, {
      generatedCourseId: courseId,
      courseShellCreatedAt: now,
    });
    const { error: planError } = await supabase
      .from("ai_course_plans")
      .update({
        status: "selected",
        course_id: courseId,
        selected_items: [nextSelection],
      })
      .eq("id", planId);

    if (planError) throw planError;
  } catch (error) {
    try {
      await supabase.from("courses").delete().eq("id", courseId);
    } catch (cleanupError) {
      logAppError(cleanupError, {
        operation: "admin.course_planner.shell_generation.cleanup",
        resourceId: courseId,
        metadata: { planId },
      });
    }
    throw error;
  }

  return {
    courseId,
    returnPath: `/admin/courses/${courseId}`,
    notice:
      "AI course setup created. Review the course, generate course media, and enable it when ready. Create lessons later from the planner.",
  };
}

export async function generatePlannedLessonsFromSelectedPlanCommand(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<PlannerMaybeHandoffResult> {
  const planId = asString(formData.get("planId"), 120);
  const plan = await getPlannerPlan(supabase, planId);

  if (plan.mode !== "new_course") {
    throw new Error("This action only supports new course plans.");
  }

  const stored = parseStoredNewCoursePlan(plan.generated_plan);
  if (!stored) {
    logInvalidPlannerRecord("admin.course_planner.planned_lessons_plan.parse", plan);
    throw new Error("The saved course brief is invalid.");
  }

  const selectedOption = getSelectedNewCoursePlanSelection(plan);
  if (!selectedOption) {
    throw new Error("Select or generate a course brief before generating planned lessons.");
  }

  if (!selectedOption.generatedCourseId) {
    throw new Error("Create the course setup first before drafting the planned lessons.");
  }

  if (selectedOption.lessonsGeneratedAt) {
    return {
      courseId: selectedOption.generatedCourseId,
      returnPath: `/admin/courses/${selectedOption.generatedCourseId}`,
      notice: "Planned lessons were already created for this course.",
    };
  }

  const { data: existingLessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", selectedOption.generatedCourseId)
    .limit(1);

  if (lessonsError) throw lessonsError;
  if ((existingLessons ?? []).length > 0) {
    throw new Error("This course already has lessons. Use the expansion planner for additional lesson drafts.");
  }

  const nextSelection = buildSelectedPlanSelection(selectedOption, {
    lessonsGeneratedAt: new Date().toISOString(),
    lessonsGeneratedCount: selectedOption.lessonOutline.length,
  });
  const { error: planError } = await supabase
    .from("ai_course_plans")
    .update({
      status: "used",
      course_id: selectedOption.generatedCourseId,
      selected_items: [nextSelection],
    })
    .eq("id", planId);

  if (planError) throw planError;

  return {
    courseId: selectedOption.generatedCourseId,
    draftFormData: buildPlannedLessonsDraftFormData(stored.input, selectedOption, selectedOption.generatedCourseId),
  };
}

export async function generateLessonFromExpansionSuggestionCommand(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<PlannerAiGenerationHandoff> {
  const planId = asString(formData.get("planId"), 120);
  const suggestionIndex = parseInteger(formData.get("suggestionIndex"), 0);
  const plan = await getPlannerPlan(supabase, planId);
  const stored = parseStoredCourseExpansionPlan(plan.generated_plan);

  if (!stored) {
    logInvalidPlannerRecord("admin.course_planner.expansion_suggestion_plan.parse", plan);
    throw new Error("The saved expansion plan is invalid.");
  }

  const suggestion = stored.result.lessonSuggestions[suggestionIndex];
  if (!suggestion) {
    throw new Error("Selected lesson suggestion not found.");
  }

  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "used",
      selected_items: [suggestion],
    })
    .eq("id", planId);

  if (error) throw error;

  const draftFormData = new FormData();
  draftFormData.set("courseId", stored.input.courseId);
  draftFormData.set("topic", suggestion.title);
  draftFormData.set("audience", `Learners continuing the course "${stored.input.courseTitle}"`);
  draftFormData.set("region", "Current course context");
  draftFormData.set("difficulty", suggestion.difficulty);
  draftFormData.set("tone", "clear, practical, encouraging");
  draftFormData.set("lessonCount", "1");
  draftFormData.set("questionsPerLesson", String(getRecommendedQuestionCount(suggestion.difficulty)));
  draftFormData.set(
    "notes",
    buildExpansionDraftNotes(
      stored.input.courseTitle,
      suggestion,
      stored.result.courseAnalysis,
      stored.input.notes ?? "",
    ),
  );
  draftFormData.set(
    "continuityInstruction",
    buildExpansionContinuityInstruction(stored.input.courseTitle, suggestion, stored.input.notes ?? ""),
  );

  return {
    courseId: stored.input.courseId,
    draftFormData,
  };
}

export async function dismissCoursePlanCommand(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<PlannerCommandResult> {
  const planId = asString(formData.get("planId"), 120);
  const returnPath = asString(
    formData.get("redirectTo"),
    400,
    "/admin/courses/ai/planner",
  );
  const plan = await getPlannerPlan(supabase, planId);

  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "dismissed",
      selected_items: [],
    })
    .eq("id", planId);

  if (error) throw error;

  return {
    courseId: plan.course_id,
    returnPath,
    notice: "Planner result dismissed.",
  };
}
