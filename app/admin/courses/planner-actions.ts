"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import {
  requireAdminCourseAiAuthoring,
  requireAdminWorkspaceAiAuthoring,
} from "@/features/organizations/admin/entitlement-guards";
import type { AdminContext } from "@/features/admin/application/context";
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

async function requirePlannerPlanAiAuthoring(admin: AdminContext, formData: FormData) {
  const planId = asString(formData.get("planId"), 120);

  if (!planId) {
    await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/ai/planner");
    return;
  }

  const { data, error } = await admin.supabase
    .from("ai_course_plans")
    .select("course_id")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  await requireAdminCourseAiAuthoring(
    admin,
    data?.course_id ?? "",
    "/admin/courses/ai/planner",
  );
}

export async function generateNewCoursePlanOptions(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/ai/planner");
  const result = await generateNewCoursePlanOptionsCommand(admin, formData);
  finishPlannerCommand(result);
}

export async function generateCourseExpansionPlan(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminCourseAiAuthoring(
    admin,
    asString(formData.get("course_id"), 120),
    "/admin/courses/ai/planner",
  );
  const result = await generateCourseExpansionPlanCommand(admin, formData);
  finishPlannerCommand(result);
}

export async function selectCoursePlanOption(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/ai/planner");
  const { supabase } = admin;
  const result = await selectCoursePlanOptionCommand(supabase, formData);
  finishPlannerCommand(result);
}

export async function handleNewCoursePlanOptionSubmission(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/ai/planner");
  const submitIntent = asString(formData.get("submitIntent"), 40);

  if (submitIntent === "use-brief") {
    const { supabase } = admin;
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
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/ai/planner");
  const { supabase } = admin;
  const result = await generateCourseFromSelectedPlanCommand(supabase, formData);
  revalidatePlannerPaths(result.courseId);
  await generateAiCourseDraft(result.draftFormData);
}

export async function generateCourseShellFromSelectedPlan(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/ai/planner");
  const result = await generateCourseShellFromSelectedPlanCommand(admin, formData);
  finishPlannerCommand(result);
}

export async function generatePlannedLessonsFromSelectedPlan(formData: FormData) {
  const admin = await requireAdmin();
  await requirePlannerPlanAiAuthoring(admin, formData);
  const { supabase } = admin;
  const result = await generatePlannedLessonsFromSelectedPlanCommand(supabase, formData);
  if ("returnPath" in result) {
    finishPlannerCommand(result);
  }

  revalidatePlannerPaths(result.courseId);
  await extendCourseWithAiLessons(result.draftFormData);
}

export async function generateLessonFromExpansionSuggestion(formData: FormData) {
  const admin = await requireAdmin();
  await requirePlannerPlanAiAuthoring(admin, formData);
  const { supabase } = admin;
  const result = await generateLessonFromExpansionSuggestionCommand(supabase, formData);
  revalidatePlannerPaths(result.courseId);
  await extendCourseWithAiLessons(result.draftFormData);
}
