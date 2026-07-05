"use server";

import {
  approveLessonMedia as approveLessonMediaBase,
  approveLessonManualMedia as approveLessonManualMediaBase,
  approveLearningMediaAsset as approveLearningMediaAssetBase,
  approveLessonText as approveLessonTextBase,
  generateLearningMediaAsset as generateLearningMediaAssetBase,
  generateLessonMediaAssets as generateLessonMediaAssetsBase,
  requestLessonMediaChanges as requestLessonMediaChangesBase,
  requestLessonTextChanges as requestLessonTextChangesBase,
  saveLearningMediaAsset as saveLearningMediaAssetBase,
  useLibraryMediaAsset as applyLibraryMediaAssetBase,
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

export async function approveLessonManualMedia(formData: FormData) {
  return approveLessonManualMediaBase(formData);
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

export async function requestLessonMediaChanges(formData: FormData) {
  return requestLessonMediaChangesBase(formData);
}

export async function saveLearningMediaAsset(formData: FormData) {
  return saveLearningMediaAssetBase(formData);
}
