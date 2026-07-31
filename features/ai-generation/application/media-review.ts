import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCourseMediaAssets,
  getCourseWorkflowData,
  getLessonWorkflowData,
  insertAiGenerationAuditEvent,
  recomputeCourseAiStatuses,
  type WorkflowMediaAssetRow,
} from "@/features/ai-generation/data/workflow";
import {
  appendMediaRevisionFeedback,
} from "@/features/ai-generation/domain/revision";
import {
  ensureAiCourse,
  ensureAiLesson,
  getApprovedReviewStatus,
} from "@/features/ai-generation/domain/workflow-status";
import {
  getImagePayloadString,
} from "@/features/ai-generation/application/form-input";
import {
  getMediaMetadataString,
} from "@/features/ai-generation/application/media-targets";
import {
  isRequiredMediaAsset,
  validateMediaApproval,
  type MediaApprovalValidation,
} from "@/lib/ai-media-workflow";
import type { Database, Json } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

type MediaReviewResult = {
  courseId: string;
  lessonIds: string[];
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function approveCourseMediaReview(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
): Promise<MediaReviewResult> {
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (course.ai_text_status !== "approved") {
    throw new Error("Approve the course text before approving media.");
  }

  const approvedAt = new Date().toISOString();
  const lessonIds = lessons.map((lesson) => lesson.id);
  const { data: assets, error: assetQueryError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId);

  if (assetQueryError) throw assetQueryError;

  const typedAssets = (assets ?? []) as WorkflowMediaAssetRow[];
  const validation: MediaApprovalValidation<WorkflowMediaAssetRow> = validateMediaApproval(typedAssets);
  const hasRequiredImageAssets = typedAssets.some(isRequiredMediaAsset);
  if (
    !hasRequiredImageAssets
    || validation.missingRequiredAssets.length > 0
    || validation.failedRequiredAssets.length > 0
  ) {
    throw new Error(
      "Required media assets are still missing, failed, or not seeded yet. Regenerate media and confirm the required previews before approval.",
    );
  }

  for (const asset of typedAssets) {
    const nextReviewStatus = getApprovedReviewStatus(asset);
    if (nextReviewStatus === asset.review_status) {
      continue;
    }

    const { error: assetReviewError } = await supabase
      .from("learning_media_assets")
      .update({ review_status: nextReviewStatus })
      .eq("id", asset.id);

    if (assetReviewError) throw assetReviewError;
  }

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      ai_media_status: "approved",
      ai_publish_status: "ready",
      media_approved_at: approvedAt,
      media_approved_by: actorUserId,
    })
    .eq("id", courseId);

  if (courseError) throw courseError;

  if (lessonIds.length > 0) {
    const { error: lessonsError } = await supabase
      .from("lessons")
      .update({
        ai_media_status: "approved",
        ai_publish_status: "ready",
        media_approved_at: approvedAt,
        media_approved_by: actorUserId,
      })
      .in("id", lessonIds);

    if (lessonsError) throw lessonsError;
  }

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_media_approved", "course", courseId, {
    approvedAt,
  });

  return { courseId, lessonIds };
}

export async function approveCourseManualMediaReview(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
): Promise<MediaReviewResult> {
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (course.ai_text_status !== "approved") {
    throw new Error("Approve course text before approving manual media.");
  }

  const manualUrl = getImagePayloadString(course.thumbnail as Record<string, unknown> | null, "src");
  if (!manualUrl) {
    throw new Error("Add a course thumbnail before approving manual media.");
  }

  const now = new Date().toISOString();
  const lessonIds = lessons.map((lesson) => lesson.id);
  const assets = await getCourseMediaAssets(supabase, courseId);
  const courseAssets = assets.filter((asset) => asset.lesson_id === null);
  let requiredAsset = courseAssets.find((asset) => isRequiredMediaAsset(asset));

  if (!requiredAsset) {
    const { data: insertedAsset, error: insertError } = await supabase
      .from("learning_media_assets")
      .insert({
        course_id: course.id,
        lesson_id: null,
        asset_type: "thumbnail",
        placement: "course_thumbnail",
        source: "manual",
        prompt: "Editor-provided course media.",
        script: "",
        url: manualUrl,
        storage_path: null,
        provider: "manual",
        model: "manual",
        alt_text: getImagePayloadString(course.thumbnail as Record<string, unknown> | null, "alt") || `${course.title} course thumbnail`,
        caption: course.title,
        metadata: {
          required: true,
          targetKind: "course_thumbnail",
          manuallyApprovedAt: now,
          manuallyApprovedBy: actorUserId,
        } as Json,
        review_status: "approved",
        generation_status: "skipped",
        generation_error: null,
        sort_order: courseAssets.reduce((max, asset) => Math.max(max, asset.sort_order), -1) + 1,
      })
      .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
      .single();

    if (insertError) throw insertError;
    requiredAsset = insertedAsset as WorkflowMediaAssetRow;
  } else {
    const { error: updateAssetError } = await supabase
      .from("learning_media_assets")
      .update({
        source: "manual",
        url: manualUrl,
        provider: "manual",
        model: "manual",
        alt_text: getImagePayloadString(course.thumbnail as Record<string, unknown> | null, "alt") || requiredAsset.alt_text || `${course.title} course thumbnail`,
        caption: requiredAsset.caption || course.title,
        review_status: "approved",
        generation_status: "skipped",
        generation_error: null,
        metadata: {
          ...asRecord(requiredAsset.metadata),
          required: true,
          targetKind: getMediaMetadataString(asRecord(requiredAsset.metadata), "targetKind") || "course_thumbnail",
          manuallyApprovedAt: now,
          manuallyApprovedBy: actorUserId,
        } as Json,
      })
      .eq("id", requiredAsset.id);

    if (updateAssetError) throw updateAssetError;
  }

  const aggregate = await recomputeCourseAiStatuses(supabase, courseId, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_manual_media_approved", "course", courseId, {
    approvedAt: now,
    assetId: requiredAsset.id,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  return { courseId, lessonIds };
}

export async function requestCourseMediaReviewChanges(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
  feedback: string,
): Promise<MediaReviewResult> {
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);
  const nextNotes = appendMediaRevisionFeedback(asRecord(course.ai_generation_notes), {
    kind: "request",
    feedback,
    requestedAt: new Date().toISOString(),
    requestedBy: actorUserId,
  });

  const lessonIds = lessons.map((lesson) => lesson.id);

  const { error: assetsError } = await supabase
    .from("learning_media_assets")
    .update({ review_status: "changes_requested" })
    .eq("course_id", courseId);

  if (assetsError) throw assetsError;

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      ai_media_status: "changes_requested",
      ai_publish_status: "not_ready",
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: nextNotes as Json,
    })
    .eq("id", courseId);

  if (courseError) throw courseError;

  if (lessonIds.length > 0) {
    const { error: lessonsError } = await supabase
      .from("lessons")
      .update({
        ai_media_status: "changes_requested",
        ai_publish_status: "not_ready",
        media_approved_at: null,
        media_approved_by: null,
      })
      .in("id", lessonIds);

    if (lessonsError) throw lessonsError;
  }

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_media_changes_requested", "course", courseId, {
    feedback,
  });

  return { courseId, lessonIds };
}

export async function approveLessonMediaReview(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  lessonId: string,
): Promise<MediaReviewResult> {
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  if (lesson.ai_text_status !== "approved") {
    throw new Error("Approve this lesson's text before approving lesson media.");
  }

  const lessonAssets = (await getCourseMediaAssets(supabase, course.id))
    .filter((asset) => asset.lesson_id === lessonId);
  const validation: MediaApprovalValidation<WorkflowMediaAssetRow> = validateMediaApproval(lessonAssets);
  const hasRequiredImageAssets = lessonAssets.some(isRequiredMediaAsset);

  if (
    !hasRequiredImageAssets
    || validation.missingRequiredAssets.length > 0
    || validation.failedRequiredAssets.length > 0
  ) {
    throw new Error(
      "Required lesson media assets are still missing, failed, or not seeded yet. Generate lesson media and confirm the required previews before approval.",
    );
  }

  for (const asset of lessonAssets) {
    const nextReviewStatus = getApprovedReviewStatus(asset);
    if (nextReviewStatus === asset.review_status) {
      continue;
    }

    const { error: assetReviewError } = await supabase
      .from("learning_media_assets")
      .update({ review_status: nextReviewStatus })
      .eq("id", asset.id);

    if (assetReviewError) throw assetReviewError;
  }

  const approvedAt = new Date().toISOString();
  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_media_status: "approved",
      ai_publish_status: "ready",
      media_approved_at: approvedAt,
      media_approved_by: actorUserId,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_lesson_media_approved", "lesson", lessonId, {
    courseId: course.id,
    approvedAt,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  return {
    courseId: course.id,
    lessonIds: lessons.map((item) => item.id),
  };
}

export async function approveLessonManualMediaReview(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  lessonId: string,
): Promise<MediaReviewResult> {
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  if (lesson.ai_text_status !== "approved") {
    throw new Error("Approve this lesson's text before approving manual media.");
  }

  const manualUrl = getImagePayloadString(lesson.cover_image as Record<string, unknown> | null, "src");
  if (!manualUrl) {
    throw new Error("Add a lesson thumbnail or cover image before approving manual media.");
  }

  const existingAssets = (await getCourseMediaAssets(supabase, course.id))
    .filter((asset) => asset.lesson_id === lessonId);
  let requiredAsset = existingAssets.find((asset) => isRequiredMediaAsset(asset));
  const now = new Date().toISOString();

  if (!requiredAsset) {
    const { data: insertedAsset, error: insertError } = await supabase
      .from("learning_media_assets")
      .insert({
        course_id: course.id,
        lesson_id: lesson.id,
        asset_type: "thumbnail",
        placement: "lesson_thumbnail",
        source: "manual",
        prompt: "Editor-provided lesson media.",
        script: "",
        url: manualUrl,
        storage_path: null,
        provider: "manual",
        model: "manual",
        alt_text: getImagePayloadString(lesson.cover_image as Record<string, unknown> | null, "alt") || `${lesson.title} lesson image`,
        caption: lesson.title,
        metadata: {
          required: true,
          targetKind: "lesson_thumbnail",
          manuallyApprovedAt: now,
          manuallyApprovedBy: actorUserId,
        } as Json,
        review_status: "approved",
        generation_status: "skipped",
        generation_error: null,
        sort_order: existingAssets.reduce((max, asset) => Math.max(max, asset.sort_order), -1) + 1,
      })
      .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
      .single();

    if (insertError) throw insertError;
    requiredAsset = insertedAsset as WorkflowMediaAssetRow;
  } else {
    const { error: updateAssetError } = await supabase
      .from("learning_media_assets")
      .update({
        source: "manual",
        url: manualUrl,
        provider: "manual",
        model: "manual",
        alt_text: getImagePayloadString(lesson.cover_image as Record<string, unknown> | null, "alt") || requiredAsset.alt_text || `${lesson.title} lesson image`,
        caption: requiredAsset.caption || lesson.title,
        review_status: "approved",
        generation_status: "skipped",
        generation_error: null,
        metadata: {
          ...asRecord(requiredAsset.metadata),
          required: true,
          targetKind: getMediaMetadataString(asRecord(requiredAsset.metadata), "targetKind") || "lesson_thumbnail",
          manuallyApprovedAt: now,
          manuallyApprovedBy: actorUserId,
        } as Json,
      })
      .eq("id", requiredAsset.id);

    if (updateAssetError) throw updateAssetError;
  }

  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_media_status: "approved",
      ai_publish_status: "ready",
      media_approved_at: now,
      media_approved_by: actorUserId,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_lesson_manual_media_approved", "lesson", lessonId, {
    courseId: course.id,
    approvedAt: now,
    assetId: requiredAsset.id,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  return {
    courseId: course.id,
    lessonIds: lessons.map((item) => item.id),
  };
}

export async function requestLessonMediaReviewChanges(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  lessonId: string,
  feedback: string,
): Promise<MediaReviewResult> {
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);
  const nextNotes = appendMediaRevisionFeedback(asRecord(lesson.ai_generation_notes), {
    kind: "request",
    feedback,
    requestedAt: new Date().toISOString(),
    requestedBy: actorUserId,
  });

  const { error: assetsError } = await supabase
    .from("learning_media_assets")
    .update({ review_status: "changes_requested" })
    .eq("course_id", course.id)
    .eq("lesson_id", lessonId);

  if (assetsError) throw assetsError;

  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_media_status: "changes_requested",
      ai_publish_status: "not_ready",
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: nextNotes as Json,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_lesson_media_changes_requested", "lesson", lessonId, {
    courseId: course.id,
    feedback,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  return {
    courseId: course.id,
    lessonIds: lessons.map((item) => item.id),
  };
}
