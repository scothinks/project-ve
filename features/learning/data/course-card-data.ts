import "server-only";

import { unstable_cache } from "next/cache";
import { logAppError, toDependencyUnavailableError } from "@/lib/app-errors";
import { parseImagePresentation } from "@/lib/image-presentation";
import type { CourseLevel, ImageAsset, LessonRetryPolicy } from "@/lib/lessons";
import type { AppSupabaseClient } from "@/lib/supabase";
import type {
  LearningCourseCard,
  LearningLessonCard,
} from "@/features/learning/application/course-card-model";
import { learningCourseCardSelections } from "@/features/learning/data/course-card-projections";

export const PUBLISHED_LEARNING_COURSE_CARDS_CACHE_TAG =
  "published-learning-course-cards";

type CourseCardRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  level: string;
  thumbnail: Record<string, unknown> | null;
  sort_order: number;
  estimated_minutes: number;
};

type LessonCardRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image: Record<string, unknown> | null;
  sort_order: number;
  estimated_minutes: number;
  retry_mode: string;
  retry_cooldown_seconds: number | null;
  retry_requires_reread: boolean;
  max_earning_attempts: number | null;
};

type PageReferenceRow = {
  id: string;
  lesson_id: string;
  page_number: number;
};

type QuizReferenceRow = {
  id: string;
  lesson_id: string;
};

type QuestionReferenceRow = {
  id: string;
  quiz_id: string;
  xp: number;
};

const fallbackImage: ImageAsset = {
  src: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  alt: "People learning together",
};

function isCourseLevel(value: string): value is CourseLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

function isRetryMode(value: string): value is LessonRetryPolicy["mode"] {
  return value === "anytime" || value === "cooldown" || value === "disabled";
}

function getString(payload: Record<string, unknown> | null | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
}

function toImageAsset(
  image: Record<string, unknown> | null | undefined,
  fallbackAlt: string,
): ImageAsset {
  const presentation = parseImagePresentation(image);

  return {
    src: getString(image, "src") || fallbackImage.src,
    alt: getString(image, "alt") || fallbackAlt || fallbackImage.alt,
    fit: presentation.fit,
    positionX: presentation.positionX,
    positionY: presentation.positionY,
  };
}

function throwLearningCardDependencyError(error: unknown, operation: string): never {
  const appError = toDependencyUnavailableError(
    error,
    "Learning content is temporarily unavailable.",
  );
  logAppError(appError, { operation });
  throw appError;
}

async function mapCourseCardRows(
  supabase: AppSupabaseClient,
  courses: CourseCardRow[],
): Promise<LearningCourseCard[]> {
  if (courses.length === 0) {
    return [];
  }

  const courseIds = courses.map((course) => course.id);
  const { data: lessonsData, error: lessonsError } = await supabase
    .from("lessons")
    .select(learningCourseCardSelections.lessons)
    .in("course_id", courseIds)
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (lessonsError) throw lessonsError;

  const lessons = (lessonsData ?? []) as LessonCardRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [pagesResult, quizzesResult] = lessonIds.length > 0
    ? await Promise.all([
        supabase
          .from("lesson_pages")
          .select(learningCourseCardSelections.pages)
          .in("lesson_id", lessonIds)
          .order("page_number", { ascending: true }),
        supabase
          .from("quizzes")
          .select(learningCourseCardSelections.quizzes)
          .in("lesson_id", lessonIds)
          .eq("status", "published"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (pagesResult.error) throw pagesResult.error;
  if (quizzesResult.error) throw quizzesResult.error;

  const pages = (pagesResult.data ?? []) as PageReferenceRow[];
  const quizzes = (quizzesResult.data ?? []) as QuizReferenceRow[];
  const quizIds = quizzes.map((quiz) => quiz.id);
  const questionsResult = quizIds.length > 0
    ? await supabase
        .from("learner_quiz_questions")
        .select(learningCourseCardSelections.questions)
        .in("quiz_id", quizIds)
    : { data: [], error: null };

  if (questionsResult.error) throw questionsResult.error;

  const questions = (questionsResult.data ?? []) as QuestionReferenceRow[];
  const pagesByLessonId = new Map<string, PageReferenceRow[]>();
  const lessonsByCourseId = new Map<string, LessonCardRow[]>();
  const quizByLessonId = new Map(quizzes.map((quiz) => [quiz.lesson_id, quiz]));
  const questionsByQuizId = new Map<string, QuestionReferenceRow[]>();

  for (const page of pages) {
    const existing = pagesByLessonId.get(page.lesson_id) ?? [];
    existing.push(page);
    pagesByLessonId.set(page.lesson_id, existing);
  }

  for (const lesson of lessons) {
    const existing = lessonsByCourseId.get(lesson.course_id) ?? [];
    existing.push(lesson);
    lessonsByCourseId.set(lesson.course_id, existing);
  }

  for (const question of questions) {
    const existing = questionsByQuizId.get(question.quiz_id) ?? [];
    existing.push(question);
    questionsByQuizId.set(question.quiz_id, existing);
  }

  return courses.map((course): LearningCourseCard => {
    const mappedLessons = (lessonsByCourseId.get(course.id) ?? []).map(
      (lesson): LearningLessonCard => {
        const quiz = quizByLessonId.get(lesson.id);
        const quizQuestions = quiz ? questionsByQuizId.get(quiz.id) ?? [] : [];

        return {
          id: lesson.id,
          courseId: lesson.course_id,
          slug: lesson.slug,
          title: lesson.title,
          summary: lesson.description ?? "",
          order: lesson.sort_order,
          estimatedMinutes: lesson.estimated_minutes,
          status: "available",
          coverImage: toImageAsset(lesson.cover_image, lesson.title),
          retryPolicy: {
            mode: isRetryMode(lesson.retry_mode) ? lesson.retry_mode : "anytime",
            requiresReread: lesson.retry_requires_reread,
            cooldownHours: lesson.retry_cooldown_seconds
              ? Math.max(1, Math.ceil(lesson.retry_cooldown_seconds / 3600))
              : undefined,
            maxRewardedAttempts: lesson.max_earning_attempts ?? undefined,
          },
          pages: (pagesByLessonId.get(lesson.id) ?? []).map((page) => ({
            id: page.id,
            order: page.page_number,
          })),
          quiz: {
            id: quiz?.id ?? `quiz-${lesson.id.replace(/^lesson-/, "")}`,
            questionIds: quizQuestions.map((question) => question.id),
          },
          xp: quizQuestions.reduce((total, question) => total + question.xp, 0),
        };
      },
    );

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      category: course.category ?? "Values Education",
      description: course.description ?? "",
      level: isCourseLevel(course.level) ? course.level : "beginner",
      status: "available",
      thumbnail: toImageAsset(course.thumbnail, course.title),
      estimatedMinutes: mappedLessons.reduce(
        (total, lesson) => total + lesson.estimatedMinutes,
        0,
      ),
      lessons: mappedLessons,
      xp: mappedLessons.reduce((total, lesson) => total + lesson.xp, 0),
    };
  });
}

export async function getPublishedLearningCourseCards(
  supabase: AppSupabaseClient | null,
): Promise<LearningCourseCard[]> {
  if (!supabase) {
    throwLearningCardDependencyError(
      new Error("Supabase is required when APP_MODE=live."),
      "learning.course_cards.load",
    );
  }

  try {
    const { data, error } = await supabase
      .from("courses")
      .select(learningCourseCardSelections.courses)
      .eq("catalog_scope", "platform")
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return mapCourseCardRows(supabase, (data ?? []) as CourseCardRow[]);
  } catch (error) {
    throwLearningCardDependencyError(error, "learning.course_cards.load");
  }
}

export async function getLearningCourseCardsByIds(
  supabase: AppSupabaseClient | null,
  courseIds: string[],
): Promise<LearningCourseCard[]> {
  if (!supabase) {
    throwLearningCardDependencyError(
      new Error("Supabase is required when APP_MODE=live."),
      "learning.workspace_course_cards.load",
    );
  }

  const uniqueCourseIds = Array.from(new Set(courseIds)).filter(Boolean);
  if (uniqueCourseIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("courses")
      .select(learningCourseCardSelections.courses)
      .in("id", uniqueCourseIds)
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return mapCourseCardRows(supabase, (data ?? []) as CourseCardRow[]);
  } catch (error) {
    throwLearningCardDependencyError(error, "learning.workspace_course_cards.load");
  }
}

export async function getCachedPublishedLearningCourseCards(
  supabase: AppSupabaseClient,
): Promise<LearningCourseCard[]> {
  // The cached value is safe to share because the root projection is always
  // restricted to published platform courses. The request client is retained
  // only for RLS evaluation on a cache miss and is never a cache argument.
  return unstable_cache(
    async () => getPublishedLearningCourseCards(supabase),
    [PUBLISHED_LEARNING_COURSE_CARDS_CACHE_TAG],
    {
      revalidate: 300,
      tags: [PUBLISHED_LEARNING_COURSE_CARDS_CACHE_TAG],
    },
  )();
}
