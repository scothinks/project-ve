"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateLearningPaths } from "./learning-cache";
import {
  getContinuityInstruction,
  getRedirectTarget,
  parseBooleanFlag,
  parseImagePresentationInput,
  parseRequiredChangeRequest,
} from "@/features/ai-generation/application/form-input";
import { parseAiGenerationInput } from "@/features/ai-generation/application/generation-form";
import {
  requestAiCourseDraftJob,
  requestAiCourseMediaGenerationJob,
  requestAiCourseTextRevisionJob,
  requestAiLessonExtensionJob,
  requestAiLessonMediaGenerationJob,
} from "@/features/ai-generation/application/job-requests";
import {
  normalizeCourseLegacyMediaAssetsCommand,
  publishApprovedAiCourseCommand,
} from "@/features/ai-generation/application/course-finalization";
import {
  approveLearningMediaAssetCommand,
  applyLibraryMediaAssetCommand,
  queueSingleLearningMediaAssetGeneration,
  saveLearningMediaAssetCommand,
} from "@/features/ai-generation/application/media-asset-commands";
import {
  approveCourseManualMediaReview,
  approveCourseMediaReview,
  approveLessonManualMediaReview,
  approveLessonMediaReview,
  requestCourseMediaReviewChanges,
  requestLessonMediaReviewChanges,
} from "@/features/ai-generation/application/media-review";
import {
  approveCourseTextReview,
  approveLessonTextReview,
  requestCourseTextReviewChanges,
  requestLessonTextReviewChanges,
} from "@/features/ai-generation/application/text-review";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import {
  getAiMediaConfig,
} from "@/lib/ai-media-generator";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";

export async function generateAiCourseDraft(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, profile } = admin;
  const input = parseAiGenerationInput(formData);
  const result = await requestAiCourseDraftJob(supabase, profile.id, input);

  revalidatePath("/admin/courses");
  redirect(
    appendAdminNotice(
      "/admin/courses",
      `AI course draft generation queued. Job ${result.jobId} will materialize the course when the worker runs.`,
    ),
  );
}

export async function extendCourseWithAiLessons(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const input = parseAiGenerationInput(formData);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const continuityInstruction = getContinuityInstruction(formData);
  const result = await requestAiLessonExtensionJob(
    supabase,
    profile.id,
    courseId,
    continuityInstruction,
    input,
  );

  revalidatePath(`/admin/courses/${result.courseId}`);
  redirect(
    appendAdminNotice(
      `/admin/courses/${result.courseId}`,
      `AI lesson generation queued. Job ${result.jobId} will add the lessons when the worker runs.`,
    ),
  );
}

export async function approveCourseText(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const result = await approveCourseTextReview(supabase, profile.id, courseId);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Course text approved. Media generation is now unlocked."));
}

export async function requestCourseTextChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const feedback = parseRequiredChangeRequest(formData, "changeRequest");
  const result = await requestCourseTextReviewChanges(supabase, profile.id, courseId, feedback);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Text changes requested. Media generation has been locked again."));
}

export async function approveLessonText(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const result = await approveLessonTextReview(supabase, profile.id, lessonId);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Lesson text approved."));
}

export async function requestLessonTextChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const feedback = parseRequiredChangeRequest(formData, "changeRequest");
  const result = await requestLessonTextReviewChanges(supabase, profile.id, lessonId, feedback);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Lesson text changes requested. Lesson media has been locked again."));
}

export async function reviseCourseTextWithAi(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const requestedFeedback = sanitizePlainTextInput(String(formData.get("revisionRequest") ?? ""), 3000).trim();
  const result = await requestAiCourseTextRevisionJob(
    supabase,
    profile.id,
    courseId,
    requestedFeedback,
  );

  revalidatePath(`/admin/courses/${result.courseId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `AI revision queued. Job ${result.jobId} will replace the course text when the worker runs.`,
    ),
  );
}

export async function generateCourseMediaAssets(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const replaceExisting = parseBooleanFlag(formData.get("replaceExisting"));
  const applyMediaFeedback = parseBooleanFlag(formData.get("applyMediaFeedback"));
  const mediaConfig = getAiMediaConfig();

  if (!mediaConfig.canGenerate) {
    redirect(
      appendAdminNotice(
        redirectTo,
        `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
      ),
    );
  }

  const requestedMediaFeedback = sanitizePlainTextInput(String(formData.get("mediaRevisionRequest") ?? ""), 3000).trim();
  const result = await requestAiCourseMediaGenerationJob(
    supabase,
    profile.id,
    courseId,
    replaceExisting,
    applyMediaFeedback,
    requestedMediaFeedback,
  );

  revalidatePath(`/admin/courses/${result.courseId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `AI media generation queued. Job ${result.jobId} will generate course media when the worker runs.`,
    ),
  );
}

export async function generateCourseMediaDrafts(formData: FormData) {
  return generateCourseMediaAssets(formData);
}

export async function approveCourseMedia(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const result = await approveCourseMediaReview(supabase, profile.id, courseId);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Media approved. Publishing is now unlocked."));
}

export async function approveCourseManualMedia(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const result = await approveCourseManualMediaReview(supabase, profile.id, courseId);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Manual course media approved."));
}

export async function requestCourseMediaChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const feedback = parseRequiredChangeRequest(formData, "mediaChangeRequest");
  const result = await requestCourseMediaReviewChanges(supabase, profile.id, courseId, feedback);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Media changes requested. Publishing has been locked again."));
}

export async function generateLessonMediaAssets(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const replaceExisting = parseBooleanFlag(formData.get("replaceExisting"));
  const applyMediaFeedback = parseBooleanFlag(formData.get("applyMediaFeedback"));
  const mediaConfig = getAiMediaConfig();

  if (!mediaConfig.canGenerate) {
    redirect(
      appendAdminNotice(
        redirectTo,
        `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
      ),
    );
  }

  const requestedMediaFeedback = sanitizePlainTextInput(String(formData.get("mediaRevisionRequest") ?? ""), 3000).trim();
  const result = await requestAiLessonMediaGenerationJob(
    supabase,
    profile.id,
    lessonId,
    replaceExisting,
    applyMediaFeedback,
    requestedMediaFeedback,
  );

  revalidatePath(`/admin/courses/lessons/${result.lessonId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `AI lesson media generation queued. Job ${result.jobId} will generate lesson media when the worker runs.`,
    ),
  );
}

export async function approveLessonMedia(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const result = await approveLessonMediaReview(supabase, profile.id, lessonId);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Lesson media approved."));
}

export async function approveLessonManualMedia(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const result = await approveLessonManualMediaReview(supabase, profile.id, lessonId);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Manual lesson media approved."));
}

export async function generateLearningMediaAsset(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const assetId = sanitizePlainTextInput(String(formData.get("assetId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120) || null;
  const redirectTo = getRedirectTarget(formData, lessonId ? `/admin/courses/lessons/${lessonId}` : `/admin/courses/${courseId}`);
  const mediaConfig = getAiMediaConfig();

  if (!mediaConfig.canGenerate) {
    redirect(
      appendAdminNotice(
        redirectTo,
        `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
      ),
    );
  }

  const result = await queueSingleLearningMediaAssetGeneration(supabase, profile.id, assetId, courseId);

  revalidatePath(lessonId ? `/admin/courses/lessons/${lessonId}` : `/admin/courses/${courseId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `Media generation queued. Job ${result.jobId} will generate this media slot when the worker runs.`,
    ),
  );
}

export async function approveLearningMediaAsset(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const assetId = sanitizePlainTextInput(String(formData.get("assetId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120) || null;
  const redirectTo = getRedirectTarget(formData, lessonId ? `/admin/courses/lessons/${lessonId}` : `/admin/courses/${courseId}`);
  const result = await approveLearningMediaAssetCommand(supabase, profile.id, assetId, courseId);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Media approved."));
}

export async function useLibraryMediaAsset(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const assetId = sanitizePlainTextInput(String(formData.get("assetId") ?? ""), 120);
  const libraryAssetId = sanitizePlainTextInput(String(formData.get("libraryAssetId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120) || null;
  const redirectTo = getRedirectTarget(formData, lessonId ? `/admin/courses/lessons/${lessonId}` : `/admin/courses/${courseId}`);
  const result = await applyLibraryMediaAssetCommand(
    supabase,
    profile.id,
    assetId,
    libraryAssetId,
    courseId,
  );

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Library media applied."));
}

export async function requestLessonMediaChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const feedback = parseRequiredChangeRequest(formData, "mediaChangeRequest");
  const result = await requestLessonMediaReviewChanges(supabase, profile.id, lessonId, feedback);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Lesson media changes requested. Publishing has been locked again."));
}

export async function normalizeCourseLegacyMediaAssets(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const regenerateNormalized = parseBooleanFlag(formData.get("regenerateNormalized"));
  const result = await normalizeCourseLegacyMediaAssetsCommand(
    supabase,
    profile.id,
    courseId,
    regenerateNormalized,
  );

  if (result.normalizedAssetCount === 0) {
    redirect(appendAdminNotice(redirectTo, "No legacy unsupported media briefs were found for this course."));
  }

  if (regenerateNormalized) {
    const nextFormData = new FormData();
    nextFormData.set("courseId", courseId);
    nextFormData.set("redirectTo", redirectTo);
    return generateCourseMediaAssets(nextFormData);
  }

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(
    appendAdminNotice(
      redirectTo,
      `${result.normalizedAssetCount} legacy media brief${result.normalizedAssetCount === 1 ? "" : "s"} converted to supported visual types.`,
    ),
  );
}

export async function publishApprovedCourse(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const result = await publishApprovedAiCourseCommand(supabase, profile.id, courseId);

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Approved AI course published."));
}

export async function saveLearningMediaAsset(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const assetId = sanitizePlainTextInput(String(formData.get("assetId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const nextAssetType = sanitizePlainTextInput(String(formData.get("assetType") ?? "image"), 40);
  const requestedPageMediaTarget = sanitizePlainTextInput(String(formData.get("pageMediaTarget") ?? ""), 40);
  const nextUrl = sanitizeUrlInput(String(formData.get("url") ?? ""), 1000) || null;
  const presentation = parseImagePresentationInput(formData);
  const excludeFromGeneration = parseBooleanFlag(formData.get("excludeFromGeneration"));
  const result = await saveLearningMediaAssetCommand(supabase, profile.id, {
    assetId,
    courseId,
    lessonId: lessonId || null,
    assetType: nextAssetType,
    placement: sanitizePlainTextInput(String(formData.get("placement") ?? ""), 180),
    prompt: sanitizePlainTextInput(String(formData.get("prompt") ?? ""), 2000),
    script: sanitizePlainTextInput(String(formData.get("script") ?? ""), 4000),
    url: nextUrl,
    altText: sanitizePlainTextInput(String(formData.get("altText") ?? ""), 240),
    caption: sanitizePlainTextInput(String(formData.get("caption") ?? ""), 500),
    reviewStatus: sanitizePlainTextInput(String(formData.get("reviewStatus") ?? "draft"), 40),
    excludeFromGeneration,
    requestedPageMediaTarget,
    presentation,
  });

  revalidateLearningPaths(result.courseId, result.lessonIds);
  redirect(appendAdminNotice(redirectTo, "Media asset saved."));
}
