import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCourseReadiness,
  type CourseReadinessResult,
} from "@/features/learning/admin/course-readiness";
import {
  getAdminCourse,
  getAdminLearningMediaAssets,
  getAdminLessons,
  type AdminLessonBlockRow,
  type AdminLessonPageRow,
  type AdminQuizOptionRow,
  type AdminQuizQuestionRow,
  type AdminQuizRow,
} from "@/features/learning/admin/data";

export async function getAdminCourseReadiness(
  supabase: SupabaseClient,
  courseId: string,
  options: { includeLifecycleApproval?: boolean } = {},
): Promise<CourseReadinessResult> {
  const course = await getAdminCourse(supabase, courseId);

  if (!course) {
    throw new Error("Course not found.");
  }

  const [lessons, mediaAssets] = await Promise.all([
    getAdminLessons(supabase, { courseId }),
    getAdminLearningMediaAssets(supabase, { courseId }),
  ]);
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [pagesResult, quizzesResult] = lessonIds.length > 0
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

  if (pagesResult.error) throw pagesResult.error;
  if (quizzesResult.error) throw quizzesResult.error;

  const pages = (pagesResult.data ?? []) as AdminLessonPageRow[];
  const pageIds = pages.map((page) => page.id);
  const quizzes = (quizzesResult.data ?? []) as AdminQuizRow[];
  const quizIds = quizzes.map((quiz) => quiz.id);
  const [blocksResult, questionsResult] = await Promise.all([
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

  if (blocksResult.error) throw blocksResult.error;
  if (questionsResult.error) throw questionsResult.error;

  const blocks = (blocksResult.data ?? []) as AdminLessonBlockRow[];
  const questions = (questionsResult.data ?? []) as AdminQuizQuestionRow[];
  const questionIds = questions.map((question) => question.id);
  const optionsResult = questionIds.length > 0
    ? await supabase
      .from("quiz_options")
      .select("id, question_id, option_order, label, is_correct")
      .in("question_id", questionIds)
      .order("option_order", { ascending: true })
    : { data: [] as AdminQuizOptionRow[], error: null };

  if (optionsResult.error) throw optionsResult.error;

  const optionsByQuestionId = new Map<string, AdminQuizOptionRow[]>();
  for (const option of (optionsResult.data ?? []) as AdminQuizOptionRow[]) {
    const existing = optionsByQuestionId.get(option.question_id) ?? [];
    existing.push(option);
    optionsByQuestionId.set(option.question_id, existing);
  }

  return buildCourseReadiness({
    blocks,
    course,
    includeLifecycleApproval: options.includeLifecycleApproval,
    lessons,
    mediaAssets,
    pages,
    questions: questions.map((question) => ({
      ...question,
      options: optionsByQuestionId.get(question.id) ?? [],
    })),
    quizzes,
  });
}

export async function assertAdminCoursePublishReady(
  supabase: SupabaseClient,
  courseId: string,
) {
  const readiness = await getAdminCourseReadiness(supabase, courseId);

  if (!readiness.canPublish) {
    throw new Error(`Course cannot be published yet. ${readiness.blockers.map((issue) => issue.detail).join(" ")}`);
  }

  return readiness;
}
