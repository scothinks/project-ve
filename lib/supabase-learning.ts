import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  courses as seedCourses,
  lessons as seedLessons,
  type CalloutBlock,
  type Course,
  type CourseLevel,
  type ImageAsset,
  type Lesson,
  type LessonContentBlock,
  type LessonPage,
  type LessonPageType,
  type LessonRetryPolicy,
  type Quiz,
  type QuizQuestion,
  type QuizQuestionType,
} from "@/lib/lessons";

type CourseRow = {
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

type LessonRow = {
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
  quiz_requires_lesson_completion: boolean;
};

type PageRow = {
  id: string;
  lesson_id: string;
  page_number: number;
  title: string;
  subtitle: string | null;
  page_type: string;
  cover_image: Record<string, unknown> | null;
};

type BlockRow = {
  id: string;
  page_id: string;
  block_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

type QuizRow = {
  id: string;
  lesson_id: string;
  title: string;
  version: number;
};

type QuestionRow = {
  id: string;
  quiz_id: string;
  question_order: number;
  question_type: string;
  prompt: string;
  explanation: string | null;
  xp: number;
};

type OptionRow = {
  id: string;
  question_id: string;
  option_order: number;
  label: string;
  is_correct: boolean;
};

const fallbackImage: ImageAsset = {
  src: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  alt: "People learning together",
};

function isCourseLevel(value: string): value is CourseLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

function isPageType(value: string): value is LessonPageType {
  return ["primer", "concept", "example", "reflection", "summary"].includes(value);
}

function isQuestionType(value: string): value is QuizQuestionType {
  return value === "single_choice" || value === "multiple_choice" || value === "true_false";
}

function isRetryMode(value: string): value is LessonRetryPolicy["mode"] {
  return value === "anytime" || value === "cooldown" || value === "disabled";
}

function getString(payload: Record<string, unknown> | null | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function getStringRows(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((row) =>
      Array.isArray(row)
        ? row.map((cell) => String(cell).trim())
        : String(row)
            .split(",")
            .map((cell) => cell.trim()),
    )
    .filter((row) => row.some(Boolean));
}

function toImageAsset(
  image: Record<string, unknown> | null | undefined,
  fallbackAlt: string,
): ImageAsset {
  const src = getString(image, "src");
  const alt = getString(image, "alt");

  return {
    src: src || fallbackImage.src,
    alt: alt || fallbackAlt || fallbackImage.alt,
  };
}

function toOptionalImageAsset(
  image: Record<string, unknown> | null | undefined,
): ImageAsset | undefined {
  const src = getString(image, "src");
  if (!src) return undefined;

  return {
    src,
    alt: getString(image, "alt") || "Lesson page image",
  };
}

function toCalloutVariant(value: string): CalloutBlock["variant"] {
  if (value === "tip" || value === "warning" || value === "example") return value;
  return "key_point";
}

function mapContentBlock(block: BlockRow): LessonContentBlock {
  const payload = block.payload ?? {};
  const type = block.block_type;

  if (type === "callout") {
    return {
      id: block.id,
      type: "callout",
      variant: toCalloutVariant(getString(payload, "variant")),
      title: getString(payload, "title") || getString(payload, "heading") || "Key point",
      body: getString(payload, "body"),
    };
  }

  if (type === "image") {
    return {
      id: block.id,
      type: "image",
      src: getString(payload, "src"),
      alt: getString(payload, "alt") || "Lesson image",
      caption: getString(payload, "caption") || undefined,
    };
  }

  if (type === "video") {
    return {
      id: block.id,
      type: "video",
      src: getString(payload, "src"),
      poster: getString(payload, "poster") || undefined,
      title: getString(payload, "title") || getString(payload, "heading") || undefined,
      caption: getString(payload, "caption") || undefined,
    };
  }

  if (type === "audio") {
    return {
      id: block.id,
      type: "audio",
      src: getString(payload, "src"),
      title: getString(payload, "title") || getString(payload, "heading") || undefined,
      transcript: getString(payload, "transcript") || getString(payload, "body") || undefined,
    };
  }

  if (type === "table") {
    return {
      id: block.id,
      type: "table",
      title: getString(payload, "title") || getString(payload, "heading") || undefined,
      columns: getStringArray(payload.columns),
      rows: getStringRows(payload.rows),
      caption: getString(payload, "caption") || undefined,
    };
  }

  return {
    id: block.id,
    type: "text",
    heading: getString(payload, "heading") || undefined,
    body: getString(payload, "body"),
  };
}

function mapCatalog({
  courses,
  lessons,
  pages,
  blocks,
  quizzes,
  questions,
  options,
}: {
  courses: CourseRow[];
  lessons: LessonRow[];
  pages: PageRow[];
  blocks: BlockRow[];
  quizzes: QuizRow[];
  questions: QuestionRow[];
  options: OptionRow[];
}): Course[] {
  const blocksByPageId = new Map<string, BlockRow[]>();
  const pagesByLessonId = new Map<string, PageRow[]>();
  const lessonsByCourseId = new Map<string, LessonRow[]>();
  const quizByLessonId = new Map(quizzes.map((quiz) => [quiz.lesson_id, quiz]));
  const questionsByQuizId = new Map<string, QuestionRow[]>();
  const optionsByQuestionId = new Map<string, OptionRow[]>();

  for (const block of blocks) {
    const existing = blocksByPageId.get(block.page_id) ?? [];
    existing.push(block);
    blocksByPageId.set(block.page_id, existing);
  }

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

  for (const option of options) {
    const existing = optionsByQuestionId.get(option.question_id) ?? [];
    existing.push(option);
    optionsByQuestionId.set(option.question_id, existing);
  }

  return courses.map((course): Course => {
    const mappedLessons = (lessonsByCourseId.get(course.id) ?? []).map((lesson): Lesson => {
      const quizRow = quizByLessonId.get(lesson.id);
      const quiz: Quiz = {
        id: quizRow?.id ?? `quiz-${lesson.id.replace(/^lesson-/, "")}`,
        lessonId: lesson.id,
        title: quizRow?.title ?? `${lesson.title} Quiz`,
        questions: (quizRow ? questionsByQuizId.get(quizRow.id) ?? [] : []).map(
          (question): QuizQuestion => {
            const mappedOptions = (optionsByQuestionId.get(question.id) ?? []).map((option) => ({
              id: option.id,
              questionId: option.question_id,
              label: option.label,
              order: option.option_order,
            }));

            return {
              id: question.id,
              quizId: question.quiz_id,
              prompt: question.prompt,
              type: isQuestionType(question.question_type) ? question.question_type : "single_choice",
              options: mappedOptions,
              correctOptionIds: (optionsByQuestionId.get(question.id) ?? [])
                .filter((option) => option.is_correct)
                .map((option) => option.id),
              explanation: question.explanation ?? "",
              xp: question.xp,
              order: question.question_order,
            };
          },
        ),
      };

      const mappedPages: LessonPage[] = (pagesByLessonId.get(lesson.id) ?? []).map((page) => ({
        id: page.id,
        lessonId: page.lesson_id,
        title: page.title,
        subtitle: page.subtitle ?? undefined,
        order: page.page_number,
        type: isPageType(page.page_type) ? page.page_type : "concept",
        coverImage: toOptionalImageAsset(page.cover_image),
        blocks: (blocksByPageId.get(page.id) ?? []).map(mapContentBlock),
      }));

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
        quizAccess: {
          requiresLessonCompletion: lesson.quiz_requires_lesson_completion,
        },
        pages: mappedPages,
        quiz,
      };
    });
    const derivedCourseMinutes = mappedLessons.reduce(
      (total, lesson) => total + lesson.estimatedMinutes,
      0,
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
      estimatedMinutes: derivedCourseMinutes,
      progressPercent: 0,
      lessons: mappedLessons,
    };
  });
}

function findSeedCourse(idOrSlug: string) {
  return seedCourses.find((course) => course.id === idOrSlug || course.slug === idOrSlug) ?? null;
}

function findSeedLesson(idOrSlug: string) {
  const lesson = seedLessons.find((item) => item.id === idOrSlug || item.slug === idOrSlug) ?? null;
  const course = lesson
    ? seedCourses.find((item) => item.id === lesson.courseId) ?? null
    : null;

  return lesson && course ? { lesson, course } : null;
}

function findSeedQuiz(idOrLessonId: string) {
  const lesson =
    seedLessons.find(
      (item) =>
        item.id === idOrLessonId ||
        item.slug === idOrLessonId ||
        item.quiz.id === idOrLessonId,
    ) ?? null;

  return lesson ? { lesson, quiz: lesson.quiz } : null;
}

export async function getLearningCatalog(supabase: SupabaseClient | null): Promise<Course[]> {
  if (!supabase) return seedCourses;

  try {
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select("id, slug, title, description, category, level, thumbnail, sort_order, estimated_minutes")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .returns<CourseRow[]>();

    if (coursesError) throw coursesError;
    if (!courses || courses.length === 0) return [];

    const courseIds = courses.map((course) => course.id);
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, course_id, slug, title, description, cover_image, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, max_earning_attempts, quiz_requires_lesson_completion")
      .in("course_id", courseIds)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .returns<LessonRow[]>();

    if (lessonsError) throw lessonsError;

    const lessonIds = (lessons ?? []).map((lesson) => lesson.id);
    if (lessonIds.length === 0) {
      return mapCatalog({
        courses,
        lessons: [],
        pages: [],
        blocks: [],
        quizzes: [],
        questions: [],
        options: [],
      });
    }

    const [pagesResult, quizzesResult] = await Promise.all([
      supabase
        .from("lesson_pages")
        .select("id, lesson_id, page_number, title, subtitle, page_type, cover_image")
        .in("lesson_id", lessonIds)
        .order("page_number", { ascending: true })
        .returns<PageRow[]>(),
      supabase
        .from("quizzes")
        .select("id, lesson_id, title, version")
        .in("lesson_id", lessonIds)
        .eq("status", "published")
        .returns<QuizRow[]>(),
    ]);

    if (pagesResult.error) throw pagesResult.error;
    if (quizzesResult.error) throw quizzesResult.error;

    const pageIds = (pagesResult.data ?? []).map((page) => page.id);
    const quizIds = (quizzesResult.data ?? []).map((quiz) => quiz.id);

    const [blocksResult, questionsResult] = await Promise.all([
      pageIds.length > 0
        ? supabase
            .from("lesson_content_blocks")
            .select("id, page_id, block_type, sort_order, payload")
            .in("page_id", pageIds)
            .order("sort_order", { ascending: true })
            .returns<BlockRow[]>()
        : Promise.resolve({ data: [], error: null }),
      quizIds.length > 0
        ? supabase
            .from("quiz_questions")
            .select("id, quiz_id, question_order, question_type, prompt, explanation, xp")
            .in("quiz_id", quizIds)
            .order("question_order", { ascending: true })
            .returns<QuestionRow[]>()
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (blocksResult.error) throw blocksResult.error;
    if (questionsResult.error) throw questionsResult.error;

    const questionIds = (questionsResult.data ?? []).map((question) => question.id);
    const optionsResult =
      questionIds.length > 0
        ? await supabase
            .from("quiz_options")
            .select("id, question_id, option_order, label, is_correct")
            .in("question_id", questionIds)
            .order("option_order", { ascending: true })
            .returns<OptionRow[]>()
        : { data: [], error: null };

    if (optionsResult.error) throw optionsResult.error;

    return mapCatalog({
      courses,
      lessons: lessons ?? [],
      pages: pagesResult.data ?? [],
      blocks: blocksResult.data ?? [],
      quizzes: quizzesResult.data ?? [],
      questions: questionsResult.data ?? [],
      options: optionsResult.data ?? [],
    });
  } catch {
    return [];
  }
}

export async function getLearningCourse(
  supabase: SupabaseClient | null,
  idOrSlug: string,
): Promise<Course | null> {
  if (!supabase) return findSeedCourse(idOrSlug);

  const catalog = await getLearningCatalog(supabase);
  return catalog.find((course) => course.id === idOrSlug || course.slug === idOrSlug) ?? null;
}

export async function getLearningLesson(
  supabase: SupabaseClient | null,
  idOrSlug: string,
): Promise<{ lesson: Lesson; course: Course } | null> {
  if (!supabase) return findSeedLesson(idOrSlug);

  const catalog = await getLearningCatalog(supabase);

  for (const course of catalog) {
    const lesson = course.lessons.find((item) => item.id === idOrSlug || item.slug === idOrSlug);
    if (lesson) return { lesson, course };
  }

  return null;
}

export async function getLearningQuiz(
  supabase: SupabaseClient | null,
  idOrLessonId: string,
): Promise<{ lesson: Lesson; quiz: Quiz } | null> {
  if (!supabase) return findSeedQuiz(idOrLessonId);

  const catalog = await getLearningCatalog(supabase);

  for (const course of catalog) {
    const lesson = course.lessons.find(
      (item) =>
        item.id === idOrLessonId ||
        item.slug === idOrLessonId ||
        item.quiz.id === idOrLessonId,
    );
    if (lesson) return { lesson, quiz: lesson.quiz };
  }

  return null;
}
