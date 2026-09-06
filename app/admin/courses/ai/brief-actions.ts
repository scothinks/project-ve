"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import {
  requireAdminWorkspaceAiAuthoring,
} from "@/features/organizations/admin/entitlement-guards";
import { generateAiCourseDraft } from "@/app/admin/courses/ai-actions";
import {
  generateCourseFromSelectedPlanCommand,
  generateNewCoursePlanOptionsCommand,
} from "@/features/learning/admin/planner-commands";
import { appendAdminNotice } from "@/lib/admin-feedback";

export async function generateAiBrief(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/ai/brief");
  const result = await generateNewCoursePlanOptionsCommand(admin, formData, "/admin/courses/ai/result");
  redirect(appendAdminNotice(result.returnPath, result.notice));
}

export async function useAiBriefOutline(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/ai/brief");
  const { supabase } = admin;
  const result = await generateCourseFromSelectedPlanCommand(supabase, formData);
  await generateAiCourseDraft(result.draftFormData);
}
