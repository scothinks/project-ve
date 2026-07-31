import { isRequiredMediaAsset, validateMediaApproval } from "../../../lib/ai-media-workflow.ts";
import type {
  WorkflowCourseRow,
  WorkflowLessonRow,
  WorkflowMediaAssetRow,
} from "../data/workflow.ts";

export function ensureAiCourse(course: WorkflowCourseRow) {
  if (!course.ai_generated) {
    throw new Error("This workflow only applies to AI-generated courses.");
  }
}

export function ensureAiLesson(lesson: WorkflowLessonRow) {
  if (!lesson.ai_generated) {
    throw new Error("This workflow only applies to AI-generated lessons.");
  }
}

export function assetHasUsablePreview(asset: WorkflowMediaAssetRow) {
  return typeof asset.url === "string" && asset.url.trim().length > 0;
}

function assetHasStartedGenerationOrReview(asset: WorkflowMediaAssetRow) {
  return assetHasUsablePreview(asset)
    || asset.generation_status !== "pending"
    || asset.review_status !== "draft";
}

function assetEligibleForApproval(asset: WorkflowMediaAssetRow) {
  return assetHasUsablePreview(asset)
    && asset.generation_status !== "failed"
    && asset.generation_status !== "skipped";
}

export function getApprovedReviewStatus(asset: WorkflowMediaAssetRow) {
  if (!assetEligibleForApproval(asset)) {
    return asset.review_status;
  }

  if (isRequiredMediaAsset(asset)) {
    return "approved";
  }

  if (asset.review_status === "draft" || asset.review_status === "in_review") {
    return "approved";
  }

  return asset.review_status;
}

export function deriveCourseTextStatus(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
) {
  const aiLessons = lessons.filter((lesson) => lesson.ai_generated);

  if (aiLessons.length === 0) {
    return course.ai_text_status;
  }

  if (aiLessons.every((lesson) => lesson.ai_text_status === "approved")) {
    return "approved";
  }

  if (aiLessons.some((lesson) => lesson.ai_text_status === "changes_requested")) {
    return "changes_requested";
  }

  if (aiLessons.some((lesson) => lesson.ai_text_status === "approved")) {
    return "in_review";
  }

  return "draft";
}

export function deriveCourseMediaStatus(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
  assets: WorkflowMediaAssetRow[],
) {
  const aiLessons = lessons.filter((lesson) => lesson.ai_generated);

  if (aiLessons.length === 0) {
    return course.ai_media_status;
  }

  const lessonStatuses = aiLessons.map((lesson) => lesson.ai_media_status);
  const courseAssets = assets.filter((asset) => asset.lesson_id === null);
  const requiredCourseAssets = courseAssets.filter(isRequiredMediaAsset);
  const courseAssetValidation = validateMediaApproval(courseAssets);
  const courseRequiredAssetsApproved =
    requiredCourseAssets.length > 0
    && courseAssetValidation.missingRequiredAssets.length === 0
    && courseAssetValidation.failedRequiredAssets.length === 0
    && requiredCourseAssets.every((asset) => asset.review_status === "approved");

  if (lessonStatuses.every((status) => status === "approved") && courseRequiredAssetsApproved) {
    return "approved";
  }

  if (
    lessonStatuses.some((status) => status === "changes_requested")
    || courseAssets.some((asset) => asset.review_status === "changes_requested")
  ) {
    return "changes_requested";
  }

  if (
    lessonStatuses.some((status) => status === "draft" || status === "in_review" || status === "approved")
    || courseAssets.some(assetHasStartedGenerationOrReview)
  ) {
    return "in_review";
  }

  if (lessonStatuses.some((status) => status === "generation_ready")) {
    return "generation_ready";
  }

  return "not_started";
}

function aiPublishReady(status: string) {
  return status === "ready" || status === "published";
}

export function deriveCoursePublishStatus(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
  courseTextStatus: string,
  courseMediaStatus: string,
) {
  const aiLessons = lessons.filter((lesson) => lesson.ai_generated);
  const allLessonsReady = aiLessons.every((lesson) => aiPublishReady(lesson.ai_publish_status));

  if (courseTextStatus !== "approved" || courseMediaStatus !== "approved" || !allLessonsReady) {
    return "not_ready";
  }

  return course.status === "published" ? "published" : "ready";
}

export function buildCourseAiStatusPatch(
  course: Pick<WorkflowCourseRow, "text_approved_at" | "text_approved_by" | "media_approved_at" | "media_approved_by">,
  statuses: {
    textStatus: string;
    mediaStatus: string;
    publishStatus: string;
  },
  actorUserId: string,
  approvedAt = new Date().toISOString(),
) {
  const patch: Record<string, unknown> = {
    ai_text_status: statuses.textStatus,
    ai_media_status: statuses.mediaStatus,
    ai_publish_status: statuses.publishStatus,
  };

  if (statuses.textStatus === "approved") {
    patch.text_approved_at = course.text_approved_at ?? approvedAt;
    patch.text_approved_by = course.text_approved_by ?? actorUserId;
  } else {
    patch.text_approved_at = null;
    patch.text_approved_by = null;
  }

  if (statuses.mediaStatus === "approved") {
    patch.media_approved_at = course.media_approved_at ?? approvedAt;
    patch.media_approved_by = course.media_approved_by ?? actorUserId;
  } else {
    patch.media_approved_at = null;
    patch.media_approved_by = null;
  }

  return patch;
}

export function isLessonMediaApprovalReady(
  lesson: Pick<WorkflowLessonRow, "ai_text_status">,
  lessonAssets: WorkflowMediaAssetRow[],
) {
  const requiredLessonAssets = lessonAssets.filter(isRequiredMediaAsset);
  const validation = validateMediaApproval(lessonAssets);

  return lesson.ai_text_status === "approved"
    && requiredLessonAssets.length > 0
    && validation.missingRequiredAssets.length === 0
    && validation.failedRequiredAssets.length === 0
    && requiredLessonAssets.every((asset) => asset.review_status === "approved");
}
