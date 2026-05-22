import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course, Lesson } from "@/lib/lessons";
import { xpTimezone } from "@/lib/xp-constants";

export type LessonProgressRecord = {
  lesson_id: string;
  completed_pages: string[];
  completed_modules: string[];
  quiz_score: number | null;
  completed_at: string | null;
  updated_at?: string | null;
};

export type ContinueLearningItem = {
  course: Course;
  lesson: Lesson;
  href: string;
  ctaLabel: string;
  statusLabel: string;
  helperText: string;
  progressPercent: number;
};

export type CourseResumeTarget = {
  href: string;
  label: string;
};

export async function getLessonProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<LessonProgressRecord[]> {
  const [{ data: progressRows, error: progressError }, { data: pageRows, error: pageError }] =
    await Promise.all([
      supabase
        .from("lesson_progress")
        .select("lesson_id, completed_pages, completed_modules, quiz_score, completed_at, updated_at")
        .eq("user_id", userId),
      supabase
        .from("lesson_page_completions")
        .select("lesson_id, page_id, completed_at")
        .eq("user_id", userId),
    ]);

  if (progressError) {
    throw progressError;
  }

  if (pageError) {
    throw pageError;
  }

  const mergedByLessonId = new Map<string, LessonProgressRecord>();

  for (const row of progressRows ?? []) {
    mergedByLessonId.set(row.lesson_id, {
      lesson_id: row.lesson_id,
      completed_pages: row.completed_pages ?? [],
      completed_modules: row.completed_modules ?? row.completed_pages ?? [],
      quiz_score: row.quiz_score,
      completed_at: row.completed_at,
      updated_at: row.updated_at ?? null,
    });
  }

  for (const row of pageRows ?? []) {
    const existing = mergedByLessonId.get(row.lesson_id) ?? {
      lesson_id: row.lesson_id,
      completed_pages: [],
      completed_modules: [],
      quiz_score: null,
      completed_at: null,
      updated_at: row.completed_at,
    };
    const completedPages = Array.from(new Set([...existing.completed_pages, row.page_id]));

    mergedByLessonId.set(row.lesson_id, {
      ...existing,
      completed_pages: completedPages,
      completed_modules:
        existing.completed_modules.length > 0
          ? Array.from(new Set([...existing.completed_modules, row.page_id]))
          : completedPages,
      completed_at: existing.completed_at,
      updated_at:
        existing.updated_at && new Date(existing.updated_at) > new Date(row.completed_at)
          ? existing.updated_at
          : row.completed_at,
    });
  }

  return Array.from(mergedByLessonId.values());
}

export async function markLessonPageCompletedInSupabase({
  supabase,
  userId,
  lesson,
  pageId,
}: {
  supabase: SupabaseClient;
  userId: string;
  lesson: Lesson;
  pageId: string;
}) {
  const now = new Date().toISOString();

  const { error: completionError } = await supabase.from("lesson_page_completions").upsert(
    {
      user_id: userId,
      lesson_id: lesson.id,
      page_id: pageId,
      completed_at: now,
    },
    { onConflict: "user_id,lesson_id,page_id" },
  );

  if (completionError) {
    throw completionError;
  }

  const { data: existingProgress, error: readError } = await supabase
    .from("lesson_progress")
    .select("completed_pages, completed_modules, quiz_score")
    .eq("user_id", userId)
    .eq("lesson_id", lesson.id)
    .maybeSingle<{
      completed_pages: string[] | null;
      completed_modules: string[] | null;
      quiz_score: number | null;
    }>();

  if (readError) {
    throw readError;
  }

  const completedPages = Array.from(
    new Set([...(existingProgress?.completed_pages ?? []), pageId]),
  );
  const completedPageSet = new Set(completedPages);
  const isLessonComplete = lesson.pages.every((page) => completedPageSet.has(page.id));

  const { error: upsertError } = await supabase.from("lesson_progress").upsert({
    user_id: userId,
    lesson_id: lesson.id,
    completed_pages: completedPages,
    completed_modules: existingProgress?.completed_modules ?? completedPages,
    quiz_score: existingProgress?.quiz_score ?? null,
    completed_at: isLessonComplete ? now : null,
    updated_at: now,
  });

  if (upsertError) {
    throw upsertError;
  }

  return {
    completedPages,
    isLessonComplete,
  };
}

export async function upsertLessonProgress(
  supabase: SupabaseClient,
  userId: string,
  progress: LessonProgressRecord,
) {
  const { error } = await supabase.from("lesson_progress").upsert({
    user_id: userId,
    lesson_id: progress.lesson_id,
    completed_modules: progress.completed_modules,
    quiz_score: progress.quiz_score,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export function getCompletedLessonIds(progress: LessonProgressRecord[], lessons?: Lesson[]) {
  const lessonPageMap = new Map<string, string[]>();

  for (const lesson of lessons ?? []) {
    lessonPageMap.set(
      lesson.id,
      lesson.pages.map((page) => page.id),
    );
  }

  return new Set(
    progress
      .filter((record) => {
        if (record.completed_at) {
          return true;
        }

        const lessonPageIds = lessonPageMap.get(record.lesson_id);
        if (!lessonPageIds || lessonPageIds.length === 0) {
          return false;
        }

        const completedPageIds = new Set(record.completed_pages ?? []);
        return lessonPageIds.every((pageId) => completedPageIds.has(pageId));
      })
      .map((record) => record.lesson_id),
  );
}

export function getCourseProgress(course: Course, completedLessonIds?: Set<string> | string[]) {
  const completedIdSet =
    completedLessonIds instanceof Set ? completedLessonIds : new Set(completedLessonIds ?? []);
  const completedLessons = course.lessons.filter((lesson) =>
    completedLessonIds ? completedIdSet.has(lesson.id) : lesson.status === "completed",
  ).length;
  const lessonCount = course.lessons.length;

  return {
    completedLessons,
    lessonCount,
    progressPercent: lessonCount > 0 ? Math.round((completedLessons / lessonCount) * 100) : 0,
  };
}

export function getCourseResumeTarget(
  course: Course,
  lessonProgress: LessonProgressRecord[],
  completedLessonIds?: Set<string> | string[],
): CourseResumeTarget | null {
  const completedIdSet =
    completedLessonIds instanceof Set ? completedLessonIds : new Set(completedLessonIds ?? []);
  const progressByLessonId = new Map(lessonProgress.map((record) => [record.lesson_id, record]));

  const startedLessons = course.lessons
    .map((lesson) => {
      const record = progressByLessonId.get(lesson.id);
      if (!record || completedIdSet.has(lesson.id)) {
        return null;
      }

      const completedPageIds = new Set(record.completed_pages ?? []);
      const completedPageCount = lesson.pages.filter((page) => completedPageIds.has(page.id)).length;
      if (completedPageCount === 0) {
        return null;
      }

      return {
        lesson,
        record,
        completedPageIds,
        completedPageCount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const rightUpdated = right.record.updated_at ? new Date(right.record.updated_at).getTime() : 0;
      const leftUpdated = left.record.updated_at ? new Date(left.record.updated_at).getTime() : 0;
      return rightUpdated - leftUpdated;
    });

  const readingCandidate = startedLessons.find(
    (item) => item.completedPageCount < item.lesson.pages.length,
  );

  if (readingCandidate) {
    const nextPage =
      readingCandidate.lesson.pages.find((page) => !readingCandidate.completedPageIds.has(page.id)) ??
      readingCandidate.lesson.pages[readingCandidate.completedPageCount];
    const nextPageNumber =
      nextPage?.order ?? Math.min(readingCandidate.completedPageCount + 1, readingCandidate.lesson.pages.length);

    return {
      href: `/lessons/${readingCandidate.lesson.id}?page=${nextPageNumber}`,
      label: "Continue Course",
    };
  }

  const quizCandidate = startedLessons[0];
  if (quizCandidate) {
    return {
      href: `/quiz/${quizCandidate.lesson.quiz.id}`,
      label: "Continue Course",
    };
  }

  const firstAvailableLesson =
    course.lessons.find((lesson) => lesson.status !== "locked") ?? course.lessons[0];

  if (!firstAvailableLesson) {
    return null;
  }

  const isCourseComplete =
    course.lessons.length > 0 &&
    course.lessons.every((lesson) => completedIdSet.has(lesson.id));

  return {
    href: `/lessons/${firstAvailableLesson.id}`,
    label: isCourseComplete ? "Review Course" : "Start Course",
  };
}

function getNextDailyResetAt(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: xpTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(now);
  const start = new Date(`${year}-${month}-${day}T00:00:00+01:00`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function formatResumeTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: xpTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export async function getContinueLearningItem({
  supabase,
  userId,
  catalog,
  lessonProgress,
}: {
  supabase: SupabaseClient;
  userId: string;
  catalog: Course[];
  lessonProgress: LessonProgressRecord[];
}): Promise<ContinueLearningItem | null> {
  const lessonById = new Map(
    catalog.flatMap((course) => course.lessons.map((lesson) => [lesson.id, { lesson, course }] as const)),
  );
  const progressByLessonId = new Map(lessonProgress.map((record) => [record.lesson_id, record]));
  const startedLessons = lessonProgress
    .map((record) => {
      const entry = lessonById.get(record.lesson_id);
      if (!entry || (record.completed_pages?.length ?? 0) === 0) {
        return null;
      }

      const completedPageIds = new Set(record.completed_pages ?? []);
      const totalPages = entry.lesson.pages.length;
      const completedPageCount = entry.lesson.pages.filter((page) =>
        completedPageIds.has(page.id),
      ).length;
      const progressPercent =
        totalPages > 0 ? Math.round((completedPageCount / totalPages) * 100) : 0;

      return {
        ...entry,
        record,
        completedPageCount,
        totalPages,
        progressPercent,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const readingCandidate = startedLessons
    .filter((item) => item.completedPageCount < item.totalPages)
    .sort((left, right) => {
      const rightUpdated = right.record.updated_at ? new Date(right.record.updated_at).getTime() : 0;
      const leftUpdated = left.record.updated_at ? new Date(left.record.updated_at).getTime() : 0;
      return rightUpdated - leftUpdated;
    })[0];

  if (readingCandidate) {
    const nextPage =
      readingCandidate.lesson.pages.find((page) => !new Set(readingCandidate.record.completed_pages ?? []).has(page.id)) ??
      readingCandidate.lesson.pages[readingCandidate.completedPageCount];
    const nextPageNumber = nextPage?.order ?? Math.min(readingCandidate.completedPageCount + 1, readingCandidate.totalPages);

    return {
      course: readingCandidate.course,
      lesson: readingCandidate.lesson,
      href: `/lessons/${readingCandidate.lesson.id}?page=${nextPageNumber}`,
      ctaLabel: "Continue",
      statusLabel: `Page ${Math.min(readingCandidate.completedPageCount + 1, readingCandidate.totalPages)} of ${readingCandidate.totalPages}`,
      helperText: `${readingCandidate.completedPageCount}/${readingCandidate.totalPages} pages completed`,
      progressPercent: readingCandidate.progressPercent,
    };
  }

  const allQuestionIds = catalog.flatMap((course) =>
    course.lessons.flatMap((lesson) => lesson.quiz.questions.map((question) => question.id)),
  );
  const [{ data: awardedRows, error: awardedError }, { data: attemptRows, error: attemptError }] =
    await Promise.all([
      supabase
        .from("xp_transactions")
        .select("source_id")
        .eq("user_id", userId)
        .eq("direction", "earn")
        .eq("source_type", "quiz_question")
        .in("source_id", allQuestionIds),
      supabase
        .from("quiz_attempts")
        .select("lesson_id, status, ended_at, started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false }),
    ]);

  if (awardedError) {
    throw awardedError;
  }

  if (attemptError) {
    throw attemptError;
  }

  const awardedQuestionIds = new Set((awardedRows ?? []).map((row) => String(row.source_id)));
  const latestAttemptByLessonId = new Map<
    string,
    { lesson_id: string; status: string; ended_at: string | null; started_at: string }
  >();

  for (const row of attemptRows ?? []) {
    if (!latestAttemptByLessonId.has(String(row.lesson_id))) {
      latestAttemptByLessonId.set(String(row.lesson_id), {
        lesson_id: String(row.lesson_id),
        status: String(row.status),
        ended_at: row.ended_at ? String(row.ended_at) : null,
        started_at: String(row.started_at),
      });
    }
  }

  const quizCandidate = startedLessons
    .filter((item) => item.completedPageCount === item.totalPages)
    .map((item) => {
      const unearnedQuestions = item.lesson.quiz.questions.filter(
        (question) => !awardedQuestionIds.has(question.id),
      );
      if (unearnedQuestions.length === 0) {
        return null;
      }

      const latestAttempt = latestAttemptByLessonId.get(item.lesson.id);
      return {
        ...item,
        unearnedQuestions,
        latestAttempt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const rightUpdated = right.record.updated_at ? new Date(right.record.updated_at).getTime() : 0;
      const leftUpdated = left.record.updated_at ? new Date(left.record.updated_at).getTime() : 0;
      return rightUpdated - leftUpdated;
    })[0];

  if (!quizCandidate) {
    return null;
  }

  if (
    quizCandidate.latestAttempt?.ended_at &&
    quizCandidate.lesson.retryPolicy.mode === "cooldown"
  ) {
    const retryAt = new Date(
      new Date(quizCandidate.latestAttempt.ended_at).getTime() +
        (quizCandidate.lesson.retryPolicy.cooldownHours ?? 24) * 60 * 60 * 1000,
    );
    if (retryAt > new Date()) {
      return {
        course: quizCandidate.course,
        lesson: quizCandidate.lesson,
        href: `/lessons/${quizCandidate.lesson.id}?page=1`,
        ctaLabel: "Review",
        statusLabel: "Retry locked",
        helperText: `Quiz unlocks ${formatResumeTime(retryAt.toISOString())}`,
        progressPercent: 100,
      };
    }
  }

  if (quizCandidate.lesson.retryPolicy.requiresReread && quizCandidate.latestAttempt?.ended_at) {
    return {
      course: quizCandidate.course,
      lesson: quizCandidate.lesson,
      href: `/lessons/${quizCandidate.lesson.id}?page=1`,
      ctaLabel: "Review",
      statusLabel: "Reread before retry",
      helperText: `${quizCandidate.unearnedQuestions.length} quiz question${quizCandidate.unearnedQuestions.length === 1 ? "" : "s"} still earnable`,
      progressPercent: 100,
    };
  }

  if (quizCandidate.latestAttempt?.status === "daily_cap_reached") {
    return {
      course: quizCandidate.course,
      lesson: quizCandidate.lesson,
      href: `/quiz/${quizCandidate.lesson.id}`,
      ctaLabel: "Continue",
      statusLabel: "Quiz saved",
      helperText: `Next quiz XP unlocks ${formatResumeTime(getNextDailyResetAt().toISOString())}`,
      progressPercent: 100,
    };
  }

  return {
    course: quizCandidate.course,
    lesson: quizCandidate.lesson,
    href: `/quiz/${quizCandidate.lesson.id}`,
    ctaLabel:
      quizCandidate.latestAttempt?.status === "in_progress" ? "Continue quiz" : "Take quiz",
    statusLabel:
      quizCandidate.latestAttempt?.status === "in_progress" ? "Quiz in progress" : "Quiz ready",
    helperText: `${quizCandidate.unearnedQuestions.length} quiz question${quizCandidate.unearnedQuestions.length === 1 ? "" : "s"} still earnable`,
    progressPercent: 100,
  };
}
