"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import { requireAdminCourseAiAuthoring } from "@/features/organizations/admin/entitlement-guards";
import type { AdminContext } from "@/features/admin/application/context";
import { extendCourseWithAiLessons } from "@/app/admin/courses/ai-actions";
import { asString } from "@/features/learning/admin/planner-domain";
import {
  generateLessonFromExpansionSuggestionCommand,
  generatePlannedLessonsFromSelectedPlanCommand,
  type PlannerCommandResult,
} from "@/features/learning/admin/planner-commands";

function revalidatePlannerPaths(courseId?: string | null) {
  revalidatePath("/admin/courses");
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
    throw new Error("A plan is required.");
  }

  const { data, error } = await admin.supabase
    .from("ai_course_plans")
    .select("course_id")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const courseId = data?.course_id ?? "";
  await requireAdminCourseAiAuthoring(admin, courseId, `/admin/courses/${courseId}`);
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
