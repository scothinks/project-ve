"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import { sanitizePlainTextInput } from "@/lib/input-safety";

function parseBoundedInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, parsed));
}

function getSelectedIds(formData: FormData, fieldName: string) {
  const seen = new Set<string>();

  return formData
    .getAll(fieldName)
    .map((value) => sanitizePlainTextInput(String(value ?? ""), 180))
    .filter((id) => {
      if (!id || seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    });
}

export async function saveCourseCompletionRules(formData: FormData) {
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 180);
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? `/admin/courses/${courseId}`), 400);
  const requiredFinalAssessmentVersionId = sanitizePlainTextInput(
    String(formData.get("requiredFinalAssessmentVersionId") ?? ""),
    80,
  );
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_upsert_course_completion_rules", {
    p_course_id: courseId,
    p_minimum_completion_threshold: parseBoundedInteger(formData.get("minimumCompletionThreshold"), 100),
    p_minimum_quiz_score: parseBoundedInteger(formData.get("minimumQuizScore"), 0),
    p_required_final_assessment_version_id: requiredFinalAssessmentVersionId || null,
    p_required_lesson_ids: getSelectedIds(formData, "requiredLessonIds"),
    p_required_mission_ids: getSelectedIds(formData, "requiredMissionIds"),
    p_required_quiz_ids: getSelectedIds(formData, "requiredQuizIds"),
  });

  if (error) {
    throw error;
  }

  revalidatePath(`/admin/courses/${courseId}`);

  redirect(appendAdminNotice(redirectTo, "Completion rules saved."));
}
