"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { requireAdminCourseAiAuthoring } from "@/features/organizations/admin/entitlement-guards";
import { generateCourseExpansionPlanCommand } from "@/features/learning/admin/planner-commands";
import { appendAdminNotice } from "@/lib/admin-feedback";

export async function generateExpandBrief(formData: FormData) {
  const admin = await requireAdmin();
  const courseId = String(formData.get("course_id") ?? "");
  await requireAdminCourseAiAuthoring(admin, courseId, `/admin/courses/${courseId}/expand`);
  const result = await generateCourseExpansionPlanCommand(
    admin,
    formData,
    `/admin/courses/${courseId}/expand-result`,
  );
  redirect(appendAdminNotice(result.returnPath, result.notice));
}
