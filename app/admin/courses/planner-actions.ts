"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import {
  extendCourseWithAiLessons,
  generateAiCourseDraft,
} from "@/app/admin/courses/ai-actions";
import { asString } from "@/features/learning/admin/planner-domain";
import {
  dismissCoursePlanCommand,
  generateCourseExpansionPlanCommand,
  generateCourseFromSelectedPlanCommand,
  generateCourseShellFromSelectedPlanCommand,
  generateLessonFromExpansionSuggestionCommand,
  generateNewCoursePlanOptionsCommand,
  generatePlannedLessonsFromSelectedPlanCommand,
  saveSelectedNewCourseBriefCommand,
  selectCoursePlanOptionCommand,
  type PlannerCommandResult,
} from "@/features/learning/admin/planner-commands";

function revalidatePlannerPaths(courseId?: string | null) {
  revalidatePath("/admin/courses");
  revalidatePath("/admin/courses/ai/planner");
  if (courseId) {
    revalidatePath(`/admin/courses/${courseId}`);
  }
}

function finishPlannerCommand(result: PlannerCommandResult): never {
  revalidatePlannerPaths(result.courseId);
  redirect(appendAdminNotice(result.returnPath, result.notice));
}

export async function generateNewCoursePlanOptions(formData: FormData) {
  const result = await generateNewCoursePlanOptionsCommand(await requireAdmin(), formData);
  finishPlannerCommand(result);
}

export async function generateCourseExpansionPlan(formData: FormData) {
  const result = await generateCourseExpansionPlanCommand(await requireAdmin(), formData);
  finishPlannerCommand(result);
}

export async function selectCoursePlanOption(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await selectCoursePlanOptionCommand(supabase, formData);
  finishPlannerCommand(result);
}

export async function handleNewCoursePlanOptionSubmission(formData: FormData) {
  const submitIntent = asString(formData.get("submitIntent"), 40);

  if (submitIntent === "use-brief") {
    const { supabase } = await requireAdmin();
    const result = await saveSelectedNewCourseBriefCommand(supabase, formData);
    finishPlannerCommand(result);
  }

  if (submitIntent === "generate-course") {
    await generateCourseFromSelectedPlan(formData);
    return;
  }

  if (submitIntent === "generate-course-shell") {
    await generateCourseShellFromSelectedPlan(formData);
    return;
  }

  throw new Error("Unsupported planner action.");
}

export async function dismissCoursePlan(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await dismissCoursePlanCommand(supabase, formData);
  finishPlannerCommand(result);
}

export async function generateCourseFromSelectedPlan(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await generateCourseFromSelectedPlanCommand(supabase, formData);
  revalidatePlannerPaths(result.courseId);
  await generateAiCourseDraft(result.draftFormData);
}

export async function generateCourseShellFromSelectedPlan(formData: FormData) {
  const result = await generateCourseShellFromSelectedPlanCommand(await requireAdmin(), formData);
  finishPlannerCommand(result);
}

export async function generatePlannedLessonsFromSelectedPlan(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await generatePlannedLessonsFromSelectedPlanCommand(supabase, formData);
  if ("returnPath" in result) {
    finishPlannerCommand(result);
  }

  revalidatePlannerPaths(result.courseId);
  await extendCourseWithAiLessons(result.draftFormData);
}

export async function generateLessonFromExpansionSuggestion(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await generateLessonFromExpansionSuggestionCommand(supabase, formData);
  revalidatePlannerPaths(result.courseId);
  await extendCourseWithAiLessons(result.draftFormData);
}
