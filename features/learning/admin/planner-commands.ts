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
  getRecommendedQuestionCount,
  getSelectedNewCourseOptionFromForm,
  getSelectedNewCoursePlanSelection,
  logInvalidPlannerRecord,
  parseInteger,
  parseNewCoursePlanInput,
  requireValidPlannerForm,
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
  returnBasePath = "/admin/courses/ai/planner",
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
    returnPath: buildUrl(returnBasePath, { plan: plan.id }),
    notice: "Three AI course brief options are ready.",
  };
}

export async function generateCourseExpansionPlanCommand(
  admin: AdminContext,
  formData: FormData,
  returnBasePath = "/admin/courses/ai/planner",
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
    returnPath: buildUrl(returnBasePath, { courseId, plan: plan.id }),
    notice: "AI expansion suggestions are ready.",
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
