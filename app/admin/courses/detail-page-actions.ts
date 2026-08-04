"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  approveCourseMedia as approveCourseMediaBase,
  approveCourseManualMedia as approveCourseManualMediaBase,
  approveLearningMediaAsset as approveLearningMediaAssetBase,
  approveCourseText as approveCourseTextBase,
  generateLearningMediaAsset as generateLearningMediaAssetBase,
  generateCourseMediaAssets as generateCourseMediaAssetsBase,
  normalizeCourseLegacyMediaAssets as normalizeCourseLegacyMediaAssetsBase,
  publishApprovedCourse as publishApprovedCourseBase,
  reviseCourseTextWithAi as reviseCourseTextWithAiBase,
  requestCourseMediaChanges as requestCourseMediaChangesBase,
  requestCourseTextChanges as requestCourseTextChangesBase,
  saveLearningMediaAsset as saveLearningMediaAssetBase,
  useLibraryMediaAsset as applyLibraryMediaAssetBase,
} from "@/app/admin/courses/ai-actions";
import {
  generateCourseExpansionPlan as generateCourseExpansionPlanBase,
  generateLessonFromExpansionSuggestion as generateLessonFromExpansionSuggestionBase,
  generatePlannedLessonsFromSelectedPlan as generatePlannedLessonsFromSelectedPlanBase,
} from "@/app/admin/courses/planner-actions";
import {
  approveCourseReview as approveCourseReviewBase,
  archiveReviewedCourse as archiveReviewedCourseBase,
  publishReviewedCourse as publishReviewedCourseBase,
  requestCourseReviewChanges as requestCourseReviewChangesBase,
  sendCourseForReview as sendCourseForReviewBase,
  unpublishReviewedCourse as unpublishReviewedCourseBase,
} from "@/app/admin/courses/review-actions";
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

export async function approveCourseText(formData: FormData) {
  return approveCourseTextBase(formData);
}

export async function requestCourseTextChanges(formData: FormData) {
  return requestCourseTextChangesBase(formData);
}

export async function reviseCourseTextWithAi(formData: FormData) {
  return reviseCourseTextWithAiBase(formData);
}

export async function generateCourseMediaAssets(formData: FormData) {
  return generateCourseMediaAssetsBase(formData);
}

export async function normalizeCourseLegacyMediaAssets(formData: FormData) {
  return normalizeCourseLegacyMediaAssetsBase(formData);
}

export async function approveCourseMedia(formData: FormData) {
  return approveCourseMediaBase(formData);
}

export async function approveCourseManualMedia(formData: FormData) {
  return approveCourseManualMediaBase(formData);
}

export async function generateLearningMediaAsset(formData: FormData) {
  return generateLearningMediaAssetBase(formData);
}

export async function approveLearningMediaAsset(formData: FormData) {
  return approveLearningMediaAssetBase(formData);
}

export async function useLibraryMediaAsset(formData: FormData) {
  return applyLibraryMediaAssetBase(formData);
}

export async function requestCourseMediaChanges(formData: FormData) {
  return requestCourseMediaChangesBase(formData);
}

export async function publishApprovedCourse(formData: FormData) {
  return publishApprovedCourseBase(formData);
}

export async function saveLearningMediaAsset(formData: FormData) {
  return saveLearningMediaAssetBase(formData);
}

export async function sendCourseForReview(formData: FormData) {
  return sendCourseForReviewBase(formData);
}

export async function requestCourseReviewChanges(formData: FormData) {
  return requestCourseReviewChangesBase(formData);
}

export async function approveCourseReview(formData: FormData) {
  return approveCourseReviewBase(formData);
}

export async function publishReviewedCourse(formData: FormData) {
  return publishReviewedCourseBase(formData);
}

export async function unpublishReviewedCourse(formData: FormData) {
  return unpublishReviewedCourseBase(formData);
}

export async function archiveReviewedCourse(formData: FormData) {
  return archiveReviewedCourseBase(formData);
}

export async function generateCourseExpansionPlan(formData: FormData) {
  return generateCourseExpansionPlanBase(formData);
}

export async function generateLessonFromExpansionSuggestion(formData: FormData) {
  return generateLessonFromExpansionSuggestionBase(formData);
}

export async function generatePlannedLessonsFromSelectedPlan(formData: FormData) {
  return generatePlannedLessonsFromSelectedPlanBase(formData);
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
