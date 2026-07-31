import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isImageMediaAsset,
  isRequiredMediaAsset,
  validateMediaApproval,
} from "@/lib/ai-media-workflow";
import {
  getAdminContentValueTags,
  getAdminValueDimensions,
} from "@/features/content-values/admin/data";
import {
  getAdminLearningMediaAssets,
  getAdminLesson,
} from "./data";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function latestTextFeedback(notes: Record<string, unknown>) {
  const history = Array.isArray(notes.textRevisionFeedbackHistory)
    ? notes.textRevisionFeedbackHistory
    : [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = asRecord(history[index]);
    const kind = typeof entry.kind === "string" ? entry.kind : "";
    const feedback = typeof entry.feedback === "string" ? entry.feedback.trim() : "";
    if (kind === "request" && feedback) {
      return feedback;
    }
  }

  return "";
}

function latestMediaFeedback(notes: Record<string, unknown>) {
  const history = Array.isArray(notes.mediaRevisionFeedbackHistory)
    ? notes.mediaRevisionFeedbackHistory
    : [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = asRecord(history[index]);
    const kind = typeof entry.kind === "string" ? entry.kind : "";
    const feedback = typeof entry.feedback === "string" ? entry.feedback.trim() : "";
    if (kind === "request" && feedback) {
      return {
        feedback,
        requestedAt: typeof entry.requestedAt === "string" ? entry.requestedAt : null,
      };
    }
  }

  return null;
}

export async function getAdminLessonDetailPageData(
  supabase: SupabaseClient,
  lessonId: string,
) {
  const [detail, valueDimensions, valueTags] = await Promise.all([
    getAdminLesson(supabase, lessonId),
    getAdminValueDimensions(supabase),
    getAdminContentValueTags(supabase, "lesson", lessonId),
  ]);

  if (!detail) {
    return null;
  }

  const { lesson, pages, blocks, quiz, questions } = detail;
  const [mediaAssets, courseMediaAssets] = await Promise.all([
    getAdminLearningMediaAssets(supabase, {
      courseId: lesson.course_id,
      lessonId: lesson.id,
    }),
    getAdminLearningMediaAssets(supabase, {
      courseId: lesson.course_id,
    }),
  ]);

  const mediaLibraryAssets = courseMediaAssets.filter(
    (asset) => typeof asset.url === "string"
      && asset.url.trim().length > 0
      && isImageMediaAsset(asset),
  );
  const totalXp = questions.reduce((total, question) => total + question.xp, 0);
  const mediaValidation = validateMediaApproval(mediaAssets);
  const hasRequiredImageAssets = mediaAssets.some(isRequiredMediaAsset);
  const hasManualLessonMedia =
    typeof lesson.cover_image?.src === "string" && lesson.cover_image.src.trim().length > 0;
  const storedTextFeedback = latestTextFeedback(lesson.ai_generation_notes ?? {});
  const storedMediaFeedback = latestMediaFeedback(lesson.ai_generation_notes ?? {});
  const mediaApprovalBlocked =
    lesson.ai_generated
    && lesson.ai_text_status === "approved"
    && (
      !hasRequiredImageAssets
      || mediaValidation.missingRequiredAssets.length > 0
      || mediaValidation.failedRequiredAssets.length > 0
    );

  return {
    blocks,
    hasManualLessonMedia,
    hasRequiredImageAssets,
    lesson,
    mediaApprovalBlocked,
    mediaAssets,
    mediaLibraryAssets,
    mediaValidation,
    pages,
    questions,
    quiz,
    storedMediaFeedback,
    storedTextFeedback,
    totalXp,
    valueDimensions,
    valueTags,
  };
}

export type AdminLessonDetailPageData = NonNullable<Awaited<ReturnType<typeof getAdminLessonDetailPageData>>>;
