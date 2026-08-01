import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseStoredNewCoursePlanSelection,
} from "@/features/learning/admin/planner-model";
import {
  isImageMediaAsset,
  isRequiredMediaAsset,
  validateMediaApproval,
} from "@/lib/ai-media-workflow";
import {
  getAdminContentValueTags,
  getAdminValueDimensions,
} from "@/features/content-values/admin/data";
import { buildCourseReadiness } from "@/features/learning/admin/course-readiness";
import {
  getAdminAiCoursePlans,
  getAdminCourse,
  getAdminCourseCategories,
  getAdminLearningMediaAssets,
  getAdminLessons,
  type AdminLessonBlockRow,
  type AdminLearningMediaAssetRow,
  type AdminLessonPageRow,
  type AdminQuizOptionRow,
  type AdminQuizQuestionRow,
  type AdminQuizRow,
} from "./data";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = asRecord(metadata)[key];
  return typeof value === "string" ? value : "";
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
      return {
        feedback,
        requestedAt: typeof entry.requestedAt === "string" ? entry.requestedAt : null,
      };
    }
  }

  return null;
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

function findCourseShellMediaAsset(
  assets: AdminLearningMediaAssetRow[],
  targetKind: "course_thumbnail" | "course_cover",
) {
  return assets.find((asset) => {
    if (asset.lesson_id) {
      return false;
    }

    const metadataTargetKind = getMetadataString(asset.metadata, "targetKind");
    if (metadataTargetKind === targetKind) {
      return true;
    }

    if (targetKind === "course_thumbnail") {
      return asset.asset_type === "thumbnail" || asset.placement.toLowerCase() === "course_thumbnail";
    }

    return asset.asset_type === "cover" || asset.placement.toLowerCase() === "course_cover";
  }) ?? null;
}

export async function getAdminCourseDetailPageData(
  supabase: SupabaseClient,
  courseId: string,
) {
  const [
    course,
    lessons,
    categories,
    mediaAssets,
    expansionPlans,
    valueDimensions,
    valueTags,
  ] = await Promise.all([
    getAdminCourse(supabase, courseId),
    getAdminLessons(supabase, { courseId }),
    getAdminCourseCategories(supabase),
    getAdminLearningMediaAssets(supabase, { courseId }),
    getAdminAiCoursePlans(supabase, {
      courseId,
      mode: "expand_course",
      limit: 3,
      excludeStatuses: ["dismissed", "used"],
    }),
    getAdminValueDimensions(supabase),
    getAdminContentValueTags(supabase, "course", courseId),
  ]);

  if (!course) {
    return null;
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  const [lessonPages, quizzes] = lessonIds.length > 0
    ? await Promise.all([
        supabase
          .from("lesson_pages")
          .select("id, lesson_id, page_number, title, subtitle, page_type, cover_image, created_at, updated_at")
          .in("lesson_id", lessonIds)
          .order("page_number", { ascending: true }),
        supabase
          .from("quizzes")
          .select("id, lesson_id, title, version, status, ai_text_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by")
          .in("lesson_id", lessonIds),
      ])
    : [
        { data: [] as AdminLessonPageRow[], error: null },
        { data: [] as AdminQuizRow[], error: null },
      ];

  if (lessonPages.error) throw lessonPages.error;
  if (quizzes.error) throw quizzes.error;

  const lessonPageRows = (lessonPages.data ?? []) as AdminLessonPageRow[];
  const pageIds = lessonPageRows.map((page) => page.id);
  const quizRows = (quizzes.data ?? []) as AdminQuizRow[];
  const quizIds = quizRows.map((quiz) => quiz.id);
  const [lessonBlocks, quizQuestions] = await Promise.all([
    pageIds.length > 0
      ? supabase
        .from("lesson_content_blocks")
        .select("id, page_id, block_type, sort_order, payload")
        .in("page_id", pageIds)
        .order("sort_order", { ascending: true })
      : { data: [] as AdminLessonBlockRow[], error: null },
    quizIds.length > 0
      ? supabase
        .from("quiz_questions")
        .select("id, quiz_id, question_order, question_type, prompt, explanation, xp")
        .in("quiz_id", quizIds)
      : { data: [] as AdminQuizQuestionRow[], error: null },
  ]);

  if (lessonBlocks.error) throw lessonBlocks.error;
  if (quizQuestions.error) throw quizQuestions.error;

  const lessonBlockRows = (lessonBlocks.data ?? []) as AdminLessonBlockRow[];
  const quizQuestionRows = (quizQuestions.data ?? []) as AdminQuizQuestionRow[];
  const questionIds = quizQuestionRows.map((question) => question.id);
  const quizOptions = questionIds.length > 0
    ? await supabase
      .from("quiz_options")
      .select("id, question_id, option_order, label, is_correct")
      .in("question_id", questionIds)
      .order("option_order", { ascending: true })
    : { data: [] as AdminQuizOptionRow[], error: null };

  if (quizOptions.error) throw quizOptions.error;

  const optionsByQuestionId = new Map<string, AdminQuizOptionRow[]>();
  for (const option of (quizOptions.data ?? []) as AdminQuizOptionRow[]) {
    const existing = optionsByQuestionId.get(option.question_id) ?? [];
    existing.push(option);
    optionsByQuestionId.set(option.question_id, existing);
  }
  const quizQuestionsWithOptions = quizQuestionRows.map((question) => ({
    ...question,
    options: optionsByQuestionId.get(question.id) ?? [],
  }));
  const resolvedCourseNotes = asRecord(course.ai_generation_notes);
  const resolvedPlannerPlanId =
    typeof resolvedCourseNotes.plannerPlanId === "string" ? resolvedCourseNotes.plannerPlanId : "";
  const plannerShellPlanRows = resolvedPlannerPlanId
    ? await getAdminAiCoursePlans(supabase, { planId: resolvedPlannerPlanId, mode: "new_course", limit: 1 })
    : [];
  const plannerShellPlan = plannerShellPlanRows[0] ?? null;
  const plannerShellSelection = plannerShellPlan
    ? parseStoredNewCoursePlanSelection(plannerShellPlan.selected_items[0])
    : null;
  const showPlannedLessonContinuation =
    course.ai_generated
    && resolvedCourseNotes.mode === "planner_course_shell"
    && resolvedCourseNotes.plannerStage === "course_shell"
    && Boolean(plannerShellPlan)
    && Boolean(plannerShellSelection?.generatedCourseId)
    && !plannerShellSelection?.lessonsGeneratedAt;

  const mediaValidation = validateMediaApproval(mediaAssets);
  const hasRequiredImageAssets = mediaAssets.some(isRequiredMediaAsset);
  const mediaLibraryAssets = mediaAssets.filter(
    (asset) => typeof asset.url === "string"
      && asset.url.trim().length > 0
      && isImageMediaAsset(asset),
  );
  const hasManualCourseMedia =
    typeof course.thumbnail?.src === "string" && course.thumbnail.src.trim().length > 0;
  const optionalWarningCounts = mediaValidation.optionalWarnings.reduce(
    (counts, warning) => {
      for (const reason of warning.reasons) {
        counts[reason] += 1;
      }
      return counts;
    },
    {
      missing_preview: 0,
      failed_generation: 0,
    },
  );
  const optionalWarningByAssetId = new Map(
    mediaValidation.optionalWarnings.map((warning) => [warning.asset.id, warning.reasons]),
  );
  const storedTextFeedback = latestTextFeedback(course.ai_generation_notes ?? {});
  const storedMediaFeedback = latestMediaFeedback(course.ai_generation_notes ?? {});
  const legacyMediaAssetCount = mediaAssets.filter((asset) => !isImageMediaAsset(asset)).length;
  const courseThumbnailAsset = findCourseShellMediaAsset(mediaAssets, "course_thumbnail");
  const courseCoverAsset = findCourseShellMediaAsset(mediaAssets, "course_cover");
  const pagesByLessonId = new Map<string, AdminLessonPageRow[]>();
  for (const page of lessonPageRows) {
    const existing = pagesByLessonId.get(page.lesson_id) ?? [];
    existing.push(page);
    pagesByLessonId.set(page.lesson_id, existing);
  }
  const quizByLessonId = new Map(quizRows.map((quiz) => [quiz.lesson_id, quiz]));
  const questionCountByQuizId = new Map<string, number>();
  for (const question of quizQuestionRows) {
    questionCountByQuizId.set(question.quiz_id, (questionCountByQuizId.get(question.quiz_id) ?? 0) + 1);
  }
  const mediaAssetsByLessonId = new Map<string, AdminLearningMediaAssetRow[]>();
  for (const asset of mediaAssets.filter((asset) => asset.lesson_id)) {
    const lessonId = asset.lesson_id as string;
    const existing = mediaAssetsByLessonId.get(lessonId) ?? [];
    existing.push(asset);
    mediaAssetsByLessonId.set(lessonId, existing);
  }
  const mediaApprovalBlocked =
    course.ai_generated
    && course.ai_text_status === "approved"
    && (
      !hasRequiredImageAssets
      || mediaValidation.missingRequiredAssets.length > 0
      || mediaValidation.failedRequiredAssets.length > 0
    );
  const readiness = buildCourseReadiness({
    blocks: lessonBlockRows,
    course,
    lessons,
    mediaAssets,
    pages: lessonPageRows,
    questions: quizQuestionsWithOptions,
    quizzes: quizRows,
  });

  return {
    course,
    lessons,
    categories,
    mediaAssets,
    expansionPlans,
    valueDimensions,
    valueTags,
    lessonPageRows,
    lessonBlockRows,
    quizRows,
    quizQuestionRows: quizQuestionsWithOptions,
    readiness,
    plannerShellPlan,
    plannerShellSelection,
    showPlannedLessonContinuation,
    mediaValidation,
    hasRequiredImageAssets,
    mediaLibraryAssets,
    hasManualCourseMedia,
    optionalWarningCounts,
    optionalWarningByAssetId,
    storedTextFeedback,
    storedMediaFeedback,
    legacyMediaAssetCount,
    courseThumbnailAsset,
    courseCoverAsset,
    pagesByLessonId,
    quizByLessonId,
    questionCountByQuizId,
    mediaAssetsByLessonId,
    mediaApprovalBlocked,
  };
}

export type AdminCourseDetailPageData = NonNullable<Awaited<ReturnType<typeof getAdminCourseDetailPageData>>>;
