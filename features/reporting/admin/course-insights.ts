import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminCourseInsightsLesson = {
  averageQuizScore: number;
  completedPercent: number;
  id: string;
  reachedPercent: number;
  title: string;
};

export type AdminCourseInsights = {
  averageDaysToFinish: number;
  averageQuizScore: number;
  completedLearners: number;
  completionRate: number;
  lessons: AdminCourseInsightsLesson[];
  startedLearners: number;
};

export async function getAdminCourseInsights(
  supabase: SupabaseClient,
  courseId: string,
): Promise<AdminCourseInsights> {
  const [completionsResult, lessonsResult] = await Promise.all([
    supabase
      .from("course_completions")
      .select("user_id, status, completed_at, created_at")
      .eq("course_id", courseId),
    supabase
      .from("lessons")
      .select("id, title, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true }),
  ]);

  if (completionsResult.error) throw completionsResult.error;
  if (lessonsResult.error) throw lessonsResult.error;

  const completions = (completionsResult.data ?? []) as Array<{
    completed_at: string | null;
    created_at: string;
    status: string;
    user_id: string;
  }>;
  const lessonRows = (lessonsResult.data ?? []) as Array<{ id: string; title: string }>;
  const lessonIds = lessonRows.map((lesson) => lesson.id);

  const startedLearners = completions.length;
  const completedRows = completions.filter((row) => row.status === "completed");
  const completedLearners = completedRows.length;
  const completionRate = startedLearners > 0 ? Math.round((completedLearners / startedLearners) * 100) : 0;

  const finishDurations = completedRows
    .filter((row) => row.completed_at)
    .map((row) => (new Date(row.completed_at as string).getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const averageDaysToFinish = finishDurations.length > 0
    ? Math.round((finishDurations.reduce((total, days) => total + days, 0) / finishDurations.length) * 10) / 10
    : 0;

  if (lessonIds.length === 0) {
    return {
      averageDaysToFinish,
      averageQuizScore: 0,
      completedLearners,
      completionRate,
      lessons: [],
      startedLearners,
    };
  }

  const { data: progressData, error: progressError } = await supabase
    .from("lesson_progress")
    .select("lesson_id, user_id, quiz_score, completed_at")
    .in("lesson_id", lessonIds);

  if (progressError) throw progressError;

  const progressRows = (progressData ?? []) as Array<{
    completed_at: string | null;
    lesson_id: string;
    quiz_score: number | null;
    user_id: string;
  }>;

  const reachedByLessonId = new Map<string, Set<string>>();
  const completedByLessonId = new Map<string, Set<string>>();
  const quizScoresByLessonId = new Map<string, number[]>();
  const quizScores: number[] = [];
  for (const row of progressRows) {
    const reached = reachedByLessonId.get(row.lesson_id) ?? new Set<string>();
    reached.add(row.user_id);
    reachedByLessonId.set(row.lesson_id, reached);

    if (row.completed_at) {
      const completed = completedByLessonId.get(row.lesson_id) ?? new Set<string>();
      completed.add(row.user_id);
      completedByLessonId.set(row.lesson_id, completed);
    }

    if (typeof row.quiz_score === "number") {
      quizScores.push(row.quiz_score);
      const scores = quizScoresByLessonId.get(row.lesson_id) ?? [];
      scores.push(row.quiz_score);
      quizScoresByLessonId.set(row.lesson_id, scores);
    }
  }

  const averageQuizScore = quizScores.length > 0
    ? Math.round(quizScores.reduce((total, score) => total + score, 0) / quizScores.length)
    : 0;

  const lessons = lessonRows.map((lesson) => {
    const reachedCount = reachedByLessonId.get(lesson.id)?.size ?? 0;
    const completedCount = completedByLessonId.get(lesson.id)?.size ?? 0;
    const lessonQuizScores = quizScoresByLessonId.get(lesson.id) ?? [];
    return {
      averageQuizScore: lessonQuizScores.length > 0
        ? Math.round(lessonQuizScores.reduce((total, score) => total + score, 0) / lessonQuizScores.length)
        : 0,
      completedPercent: startedLearners > 0 ? Math.round((completedCount / startedLearners) * 100) : 0,
      id: lesson.id,
      reachedPercent: startedLearners > 0 ? Math.round((reachedCount / startedLearners) * 100) : 0,
      title: lesson.title,
    };
  });

  return {
    averageDaysToFinish,
    averageQuizScore,
    completedLearners,
    completionRate,
    lessons,
    startedLearners,
  };
}
