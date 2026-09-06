"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateLearningPaths } from "./learning-cache";
import {
  getContinuityInstruction,
  getRedirectTarget,
  parseRequiredChangeRequest,
} from "@/features/ai-generation/application/form-input";
import { parseAiGenerationInput } from "@/features/ai-generation/application/generation-form";
import {
  requestAiCourseDraftJob,
  requestAiCourseTextRevisionJob,
  requestAiLessonExtensionJob,
  requestAiLessonPageExtensionJob,
  requestAiQuizQuestionGenerationJob,
} from "@/features/ai-generation/application/job-requests";
import {
  approveCourseTextReview,
  approveLessonTextReview,
  requestCourseTextReviewChanges,
  requestLessonTextReviewChanges,
} from "@/features/ai-generation/application/text-review";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import {
  getAdminWorkspaceOrganizationId,
} from "@/features/ai-generation/application/organization-ai-metering";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import {
  requireAdminCourseAiAuthoring,
  requireAdminLessonAiAuthoring,
  requireAdminWorkspaceAiAuthoring,
} from "@/features/organizations/admin/entitlement-guards";

export async function generateAiCourseDraft(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses");
  const { supabase, profile } = admin;
  const input = parseAiGenerationInput(formData);
  const result = await requestAiCourseDraftJob(
    supabase,
    profile.id,
    input,
    getAdminWorkspaceOrganizationId(admin),
  );

  revalidatePath("/admin/courses");
  redirect(
    appendAdminNotice(
      "/admin/courses",
      `AI course draft generation queued. Job ${result.jobId} will materialize the course when the worker runs.`,
    ),
  );
}

export async function extendCourseWithAiLessons(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, profile } = admin;
  const input = parseAiGenerationInput(formData);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  await requireAdminCourseAiAuthoring(admin, courseId, `/admin/courses/${courseId}`);
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

export async function generateAiLessonPageSuggestion(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, profile } = admin;
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  await requireAdminLessonAiAuthoring(admin, lessonId, redirectTo);

  const focus = sanitizePlainTextInput(String(formData.get("focus") ?? ""), 2000);
  const pageType = sanitizePlainTextInput(String(formData.get("pageType") ?? "concept"), 40);
  const refinementInstruction = sanitizePlainTextInput(String(formData.get("refinementInstruction") ?? ""), 2000);
  const priorDraftRaw = String(formData.get("priorDraft") ?? "");
  let priorDraft: Record<string, unknown> | null = null;
  if (priorDraftRaw) {
    try {
      const parsed = JSON.parse(priorDraftRaw) as unknown;
      priorDraft = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      priorDraft = null;
    }
  }

  const result = await requestAiLessonPageExtensionJob(supabase, profile.id, lessonId, {
    focus,
    pageType,
    priorDraft,
    refinementInstruction,
  });

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `AI page suggestion queued. Job ${result.jobId} will add the page for review when the worker runs.`,
    ),
  );
}

export async function generateAiQuizQuestion(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, profile } = admin;
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}/quiz`);
  await requireAdminLessonAiAuthoring(admin, lessonId, redirectTo);

  const result = await requestAiQuizQuestionGenerationJob(supabase, profile.id, lessonId);

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `AI quiz question queued. Job ${result.jobId} will add the question for review when the worker runs.`,
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
  const admin = await requireAdmin();
  const { supabase, profile } = admin;
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  await requireAdminCourseAiAuthoring(admin, courseId, redirectTo);
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
      `AI revision queued. Job ${result.jobId} will create an updated draft and return it to review.`,
    ),
  );
}
