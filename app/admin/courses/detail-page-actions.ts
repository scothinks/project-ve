"use server";

import {
  approveCourseMedia as approveCourseMediaBase,
  approveCourseText as approveCourseTextBase,
  generateCourseMediaAssets as generateCourseMediaAssetsBase,
  normalizeCourseLegacyMediaAssets as normalizeCourseLegacyMediaAssetsBase,
  publishApprovedCourse as publishApprovedCourseBase,
  reviseCourseTextWithAi as reviseCourseTextWithAiBase,
  requestCourseMediaChanges as requestCourseMediaChangesBase,
  requestCourseTextChanges as requestCourseTextChangesBase,
  saveLearningMediaAsset as saveLearningMediaAssetBase,
} from "@/app/admin/courses/ai-actions";
import {
  generateCourseExpansionPlan as generateCourseExpansionPlanBase,
  generateLessonFromExpansionSuggestion as generateLessonFromExpansionSuggestionBase,
  generatePlannedLessonsFromSelectedPlan as generatePlannedLessonsFromSelectedPlanBase,
} from "@/app/admin/courses/planner-actions";

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

export async function requestCourseMediaChanges(formData: FormData) {
  return requestCourseMediaChangesBase(formData);
}

export async function publishApprovedCourse(formData: FormData) {
  return publishApprovedCourseBase(formData);
}

export async function saveLearningMediaAsset(formData: FormData) {
  return saveLearningMediaAssetBase(formData);
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
