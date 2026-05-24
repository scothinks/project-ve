"use server";

import {
  approveLessonMedia as approveLessonMediaBase,
  approveLessonText as approveLessonTextBase,
  generateLessonMediaAssets as generateLessonMediaAssetsBase,
  requestLessonMediaChanges as requestLessonMediaChangesBase,
  requestLessonTextChanges as requestLessonTextChangesBase,
  saveLearningMediaAsset as saveLearningMediaAssetBase,
} from "@/app/admin/courses/ai-actions";

export async function approveLessonText(formData: FormData) {
  return approveLessonTextBase(formData);
}

export async function requestLessonTextChanges(formData: FormData) {
  return requestLessonTextChangesBase(formData);
}

export async function generateLessonMediaAssets(formData: FormData) {
  return generateLessonMediaAssetsBase(formData);
}

export async function approveLessonMedia(formData: FormData) {
  return approveLessonMediaBase(formData);
}

export async function requestLessonMediaChanges(formData: FormData) {
  return requestLessonMediaChangesBase(formData);
}

export async function saveLearningMediaAsset(formData: FormData) {
  return saveLearningMediaAssetBase(formData);
}
