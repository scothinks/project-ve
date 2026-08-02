import type {
  AdminCourseRow,
  AdminLearningMediaAssetRow,
  AdminLessonBlockRow,
  AdminLessonPageRow,
  AdminLessonRow,
  AdminQuizQuestionRow,
  AdminQuizRow,
} from "@/features/learning/admin/data";
import { getAssessmentIssues } from "./assessment-builder-domain.ts";
import {
  isImageMediaAsset,
  isRequiredMediaAsset,
  validateMediaApproval,
} from "../../../lib/ai-media-workflow.ts";

export type CourseReadinessSeverity = "blocker" | "warning";
export type CourseReadinessStatus = "passed" | "blocked" | "warning";
export type CourseEditorialLifecycle =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "archived";

export type CourseReadinessCheck = {
  detail: string;
  href?: string;
  id: string;
  label: string;
  severity: CourseReadinessSeverity;
  status: CourseReadinessStatus;
};

export type CourseReadinessResult = {
  blockers: CourseReadinessCheck[];
  canApprove: boolean;
  canPublish: boolean;
  checks: CourseReadinessCheck[];
  lifecycle: CourseEditorialLifecycle;
  lifecycleLabel: string;
  warnings: CourseReadinessCheck[];
};

export type CourseReadinessInput = {
  blocks: AdminLessonBlockRow[];
  course: AdminCourseRow;
  includeLifecycleApproval?: boolean;
  lessons: AdminLessonRow[];
  mediaAssets: AdminLearningMediaAssetRow[];
  pages: AdminLessonPageRow[];
  questions: AdminQuizQuestionRow[];
  quizzes: AdminQuizRow[];
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasImageSrc(value: Record<string, unknown> | null | undefined) {
  const src = value?.src;
  return typeof src === "string" && src.trim().length > 0;
}

function hasImageAlt(value: Record<string, unknown> | null | undefined) {
  const alt = value?.alt;
  return typeof alt === "string" && alt.trim().length > 0;
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = asRecord(metadata)[key];
  return typeof value === "string" ? value : "";
}

function findCourseMediaAsset(
  mediaAssets: AdminLearningMediaAssetRow[],
  targetKind: "course_cover" | "course_thumbnail",
) {
  return mediaAssets.find((asset) => {
    if (asset.lesson_id) return false;
    const metadataTargetKind = getMetadataString(asset.metadata, "targetKind");
    if (metadataTargetKind === targetKind) return true;
    if (targetKind === "course_thumbnail") {
      return asset.asset_type === "thumbnail" || asset.placement.toLowerCase() === "course_thumbnail";
    }
    return asset.asset_type === "cover" || asset.placement.toLowerCase() === "course_cover";
  }) ?? null;
}

function lifecycleLabel(lifecycle: CourseEditorialLifecycle) {
  const labels: Record<CourseEditorialLifecycle, string> = {
    archived: "Archived",
    approved: "Approved",
    changes_requested: "Changes requested",
    draft: "Draft",
    in_review: "In review",
    published: "Published",
  };

  return labels[lifecycle];
}

export function getCourseEditorialLifecycle(course: Pick<AdminCourseRow, "ai_media_status" | "ai_publish_status" | "ai_text_status" | "status">): CourseEditorialLifecycle {
  if (course.status === "archived") return "archived";
  if (course.status === "published" || course.ai_publish_status === "published") return "published";
  if (course.ai_text_status === "changes_requested" || course.ai_media_status === "changes_requested") {
    return "changes_requested";
  }
  if (course.ai_text_status === "in_review" || course.ai_media_status === "in_review") return "in_review";
  if (course.ai_publish_status === "ready") return "approved";
  return "draft";
}

function check({
  condition,
  detail,
  failedDetail,
  href,
  id,
  label,
  severity,
}: {
  condition: boolean;
  detail: string;
  failedDetail: string;
  href?: string;
  id: string;
  label: string;
  severity: CourseReadinessSeverity;
}): CourseReadinessCheck {
  return {
    detail: condition ? detail : failedDetail,
    href: condition ? undefined : href,
    id,
    label,
    severity,
    status: condition ? "passed" : severity === "blocker" ? "blocked" : "warning",
  };
}

function getLessonHref(lessonId: string) {
  return `/admin/courses/lessons/${lessonId}`;
}

export function buildCourseReadiness({
  blocks,
  course,
  includeLifecycleApproval = true,
  lessons,
  mediaAssets,
  pages,
  questions,
  quizzes,
}: CourseReadinessInput): CourseReadinessResult {
  const courseHref = `/admin/courses/${course.id}`;
  const mediaHref = `${courseHref}?tab=media`;
  const reviewHref = `${courseHref}?tab=review-publish`;
  const activeLessons = lessons.filter((lesson) => lesson.status !== "archived");
  const pagesByLessonId = new Map<string, AdminLessonPageRow[]>();
  const blocksByPageId = new Map<string, AdminLessonBlockRow[]>();
  const quizByLessonId = new Map(quizzes.map((quiz) => [quiz.lesson_id, quiz]));
  const questionsByQuizId = new Map<string, AdminQuizQuestionRow[]>();
  const lifecycle = getCourseEditorialLifecycle(course);

  for (const page of pages) {
    const existing = pagesByLessonId.get(page.lesson_id) ?? [];
    existing.push(page);
    pagesByLessonId.set(page.lesson_id, existing);
  }

  for (const block of blocks) {
    const existing = blocksByPageId.get(block.page_id) ?? [];
    existing.push(block);
    blocksByPageId.set(block.page_id, existing);
  }

  for (const question of questions) {
    const existing = questionsByQuizId.get(question.quiz_id) ?? [];
    existing.push(question);
    questionsByQuizId.set(question.quiz_id, existing);
  }

  const checks: CourseReadinessCheck[] = [];
  const courseOverviewComplete = Boolean(
    course.title.trim()
    && course.description.trim()
    && (course.intended_audience ?? "").trim()
    && (course.learning_outcomes?.length ?? 0) > 0
    && course.category.trim(),
  );
  checks.push(check({
    condition: courseOverviewComplete,
    detail: "Title, category, learner-facing description, intended audience and learning outcomes are present.",
    failedDetail: "Add a title, category, learner-facing description, intended audience and learning outcomes.",
    href: `${courseHref}?tab=overview`,
    id: "course-overview",
    label: "Course overview complete",
    severity: "blocker",
  }));

  const courseThumbnailAsset = findCourseMediaAsset(mediaAssets, "course_thumbnail");
  const courseCoverAsset = findCourseMediaAsset(mediaAssets, "course_cover");
  const hasThumbnail = hasImageSrc(course.thumbnail) || Boolean(courseThumbnailAsset?.url?.trim());
  const hasCover = Boolean(courseCoverAsset?.url?.trim());
  checks.push(check({
    condition: hasThumbnail && hasCover,
    detail: "Course thumbnail and cover image are present.",
    failedDetail: hasThumbnail ? "Add a course cover image." : hasCover ? "Add a course thumbnail." : "Add a course thumbnail and cover image.",
    href: mediaHref,
    id: "course-media",
    label: "Thumbnail and cover present",
    severity: "blocker",
  }));

  checks.push(check({
    condition: activeLessons.length > 0,
    detail: `${activeLessons.length} active lesson${activeLessons.length === 1 ? "" : "s"} present.`,
    failedDetail: "Add at least one active lesson.",
    href: `${courseHref}?tab=curriculum`,
    id: "lessons-present",
    label: "Course has lessons",
    severity: "blocker",
  }));

  checks.push(check({
    condition: activeLessons.length >= 5,
    detail: `${activeLessons.length} active lessons are available.`,
    failedDetail: `${activeLessons.length} active lesson${activeLessons.length === 1 ? "" : "s"} available; five is the recommended baseline.`,
    href: `${courseHref}?tab=curriculum`,
    id: "lesson-count",
    label: "Five-lesson baseline",
    severity: "warning",
  }));

  const lessonsMissingPages = activeLessons.filter((lesson) => (pagesByLessonId.get(lesson.id) ?? []).length === 0);
  const emptyPages = pages.filter((page) => (blocksByPageId.get(page.id) ?? []).length === 0);
  const firstIncompleteLesson = lessonsMissingPages[0] ?? activeLessons.find((lesson) =>
    (pagesByLessonId.get(lesson.id) ?? []).some((page) => (blocksByPageId.get(page.id) ?? []).length === 0),
  );
  checks.push(check({
    condition: lessonsMissingPages.length === 0 && emptyPages.length === 0,
    detail: "All active lessons have authored pages and content blocks.",
    failedDetail: `${lessonsMissingPages.length} lesson${lessonsMissingPages.length === 1 ? "" : "s"} missing pages; ${emptyPages.length} page${emptyPages.length === 1 ? "" : "s"} missing blocks.`,
    href: firstIncompleteLesson ? getLessonHref(firstIncompleteLesson.id) : `${courseHref}?tab=curriculum`,
    id: "lesson-pages",
    label: "Required lesson pages complete",
    severity: "blocker",
  }));

  const draftLessons = activeLessons.filter((lesson) => lesson.status !== "published").length;
  checks.push(check({
    condition: draftLessons === 0,
    detail: "All active lessons are published.",
    failedDetail: `${draftLessons} active lesson${draftLessons === 1 ? "" : "s"} not published yet.`,
    href: `${courseHref}?tab=curriculum`,
    id: "lesson-statuses",
    label: "Lesson publication status",
    severity: "warning",
  }));

  const quizBlockers = activeLessons.flatMap((lesson) => {
    const quiz = quizByLessonId.get(lesson.id) ?? null;
    if (!quiz) {
      return lesson.quiz_requires_lesson_completion
        ? [{ href: getLessonHref(lesson.id), message: `${lesson.title} requires a quiz but none exists.` }]
        : [];
    }

    const quizQuestions = questionsByQuizId.get(quiz.id) ?? [];
    return getAssessmentIssues(quizQuestions)
      .filter((issue) => issue.severity === "error")
      .map((issue) => ({
        href: getLessonHref(lesson.id),
        message: `${lesson.title}: ${issue.message}`,
      }));
  });
  checks.push(check({
    condition: quizBlockers.length === 0,
    detail: "Required quizzes have valid answer keys and questions.",
    failedDetail: quizBlockers[0]?.message ?? "One or more required quizzes are incomplete.",
    href: quizBlockers[0]?.href ?? `${courseHref}?tab=curriculum`,
    id: "assessments",
    label: "Assessments complete",
    severity: "blocker",
  }));

  const mediaValidation = validateMediaApproval(mediaAssets);
  const missingAltAssets = mediaAssets.filter((asset) =>
    isImageMediaAsset(asset)
    && Boolean(asset.url?.trim())
    && !asset.alt_text?.trim(),
  );
  const missingAltBlockCount = blocks.filter((block) =>
    block.block_type === "image"
    && typeof block.payload.src === "string"
    && block.payload.src.trim().length > 0
    && (typeof block.payload.alt !== "string" || block.payload.alt.trim().length === 0),
  ).length;
  const missingAltCourseImageCount = (hasImageSrc(course.thumbnail) && !hasImageAlt(course.thumbnail)) ? 1 : 0;
  const missingAltCount = missingAltAssets.length + missingAltBlockCount + missingAltCourseImageCount;
  const requiredMediaIssues =
    mediaValidation.missingRequiredAssets.length
    + mediaValidation.failedRequiredAssets.length
    + mediaAssets.filter((asset) => isRequiredMediaAsset(asset) && asset.review_status !== "approved").length;
  checks.push(check({
    condition: requiredMediaIssues === 0,
    detail: "Required media assets are present, generated and approved.",
    failedDetail: `${requiredMediaIssues} required media issue${requiredMediaIssues === 1 ? "" : "s"} need review.`,
    href: mediaHref,
    id: "media-approval",
    label: "Required media approved",
    severity: "blocker",
  }));
  checks.push(check({
    condition: missingAltCount === 0,
    detail: "Media alt text is complete.",
    failedDetail: `${missingAltCount} image${missingAltCount === 1 ? "" : "s"} missing alt text.`,
    href: missingAltAssets[0] ? `${mediaHref}#media-asset-${missingAltAssets[0].id}` : mediaHref,
    id: "media-alt",
    label: "Image alt text complete",
    severity: "blocker",
  }));

  const aiLessons = activeLessons.filter((lesson) => lesson.ai_generated);
  const aiTextReady =
    !course.ai_generated || (
      course.ai_text_status === "approved"
      && aiLessons.every((lesson) => lesson.ai_text_status === "approved")
      && quizzes.filter((quiz) => quiz.ai_generated).every((quiz) => quiz.ai_text_status === "approved")
    );
  checks.push(check({
    condition: aiTextReady,
    detail: "AI-generated text has been reviewed and approved.",
    failedDetail: "AI-generated course, lesson or quiz text still needs editorial approval.",
    href: reviewHref,
    id: "ai-text",
    label: "AI-generated text reviewed",
    severity: "blocker",
  }));

  const aiMediaReady =
    !course.ai_generated || (
      course.ai_media_status === "approved"
      && aiLessons.every((lesson) => lesson.ai_media_status === "approved")
    );
  checks.push(check({
    condition: aiMediaReady,
    detail: "AI-generated media has been reviewed and approved.",
    failedDetail: "AI-generated course or lesson media still needs editorial approval.",
    href: mediaHref,
    id: "ai-media",
    label: "AI-generated media reviewed",
    severity: "blocker",
  }));

  if (includeLifecycleApproval) {
    checks.push(check({
      condition: lifecycle === "approved" || lifecycle === "published",
      detail: "Editorial lifecycle is approved for publishing.",
      failedDetail: "Send the course through review and approve it before publishing.",
      href: reviewHref,
      id: "editorial-lifecycle",
      label: "Editorial approval complete",
      severity: "blocker",
    }));
  }

  const blockers = checks.filter((item) => item.status === "blocked");
  const warnings = checks.filter((item) => item.status === "warning");

  return {
    blockers,
    canApprove: blockers.filter((item) => item.id !== "editorial-lifecycle").length === 0,
    canPublish: blockers.length === 0,
    checks,
    lifecycle,
    lifecycleLabel: lifecycleLabel(lifecycle),
    warnings,
  };
}

export function getCourseReadinessIssueLabels(readiness: CourseReadinessResult) {
  return [...readiness.blockers, ...readiness.warnings].map((item) => item.detail);
}
