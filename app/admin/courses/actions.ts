"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  formatValidationIssues,
  parseReorderLessonBlockForm,
  parseReorderLessonPageForm,
  parseSaveCourseForm,
  parseSaveLessonBlockForm,
  parseSaveLessonForm,
  parseSaveLessonPageForm,
  parseSaveQuizQuestionForm,
  parseSaveQuizSettingsForm,
  parseSetCourseStatusForm,
  parseSetLessonStatusForm,
  type ImagePayload,
} from "@/lib/admin-course-validation";
import { getAssessmentIssues } from "@/features/learning/admin/assessment-builder-domain";
import { assertAdminCoursePublishReady } from "@/features/learning/admin/course-readiness-data";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { ValidationError } from "@/lib/app-errors";
import type { ValidationResult } from "@/lib/request-validation";

type AiPublishGuardRow = {
  ai_generated: boolean;
  ai_publish_status: string | null;
};

type StoredImagePayload = Record<string, unknown> | null;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeImagePayload(
  next: ImagePayload,
  existing?: StoredImagePayload,
) {
  const current = asRecord(existing);

  return {
    ...("fit" in current ? { fit: current.fit } : {}),
    ...("positionX" in current ? { positionX: current.positionX } : {}),
    ...("positionY" in current ? { positionY: current.positionY } : {}),
    ...("caption" in current ? { caption: current.caption } : {}),
    ...next,
  };
}

function aiPublishReady(status: string | null | undefined) {
  return status === "ready" || status === "published";
}

function createCopyId(prefix: string, value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "item";

  return `${prefix}-${slug}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

function requireValidForm<T>(result: ValidationResult<T>) {
  if (!result.ok) {
    throw new ValidationError(`Invalid course form data. ${formatValidationIssues(result.issues)}`);
  }

  return result.data;
}

async function assertLessonPublishAllowed(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  lessonId: string,
) {
  if (!lessonId) {
    return;
  }

  const { data, error } = await supabase
    .from("lessons")
    .select(`
      ai_generated,
      ai_publish_status,
      course:courses!lessons_course_id_fkey(
        ai_generated,
        ai_publish_status
      )
    `)
    .eq("id", lessonId)
    .maybeSingle();

  if (error) throw error;
  const guard = data as AiPublishGuardRow & {
    course:
      | {
          ai_generated: boolean;
          ai_publish_status: string | null;
        }
      | null;
  } | null;
  if (!guard || !guard.ai_generated) {
    return;
  }

  if (!aiPublishReady(guard.ai_publish_status)) {
    throw new Error("AI-generated lessons can only be published after that lesson's text and media are approved.");
  }
}

async function assertQuizPublishAllowed(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  quizId: string,
) {
  if (!quizId) {
    return;
  }

  const { data, error } = await supabase
    .from("quizzes")
    .select(`
      ai_generated,
      lesson:lessons!quizzes_lesson_id_fkey(
        ai_generated,
        ai_publish_status,
        course:courses!lessons_course_id_fkey(
          ai_generated,
          ai_publish_status
        )
      )
    `)
    .eq("id", quizId)
    .maybeSingle();

  if (error) throw error;
  const guard = data as {
    ai_generated: boolean;
    lesson:
      | {
          ai_generated: boolean;
          ai_publish_status: string | null;
          course:
            | {
                ai_generated: boolean;
                ai_publish_status: string | null;
              }
            | null;
        }
      | null;
  } | null;
  if (!guard || !guard.ai_generated) {
    return;
  }

  const lessonBlocked = Boolean(
    guard.lesson?.ai_generated && !aiPublishReady(guard.lesson.ai_publish_status),
  );

  if (lessonBlocked) {
    throw new Error("AI-generated quizzes can only be published after that lesson's text and media are approved.");
  }
}

async function assertQuizContentPublishReady(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  quizId: string,
) {
  const { data: questionsData, error: questionsError } = await supabase
    .from("quiz_questions")
    .select("id, quiz_id, question_order, question_type, prompt, explanation, xp")
    .eq("quiz_id", quizId)
    .order("question_order", { ascending: true });

  if (questionsError) throw questionsError;

  const questions = (questionsData ?? []) as Array<{
    id: string;
    quiz_id: string;
    question_order: number;
    question_type: string;
    prompt: string;
    explanation: string | null;
    xp: number;
    options?: Array<{
      id: string;
      question_id: string;
      option_order: number;
      label: string;
      is_correct: boolean;
    }>;
  }>;
  const questionIds = questions.map((question) => question.id);
  const { data: optionsData, error: optionsError } = questionIds.length > 0
    ? await supabase
      .from("quiz_options")
      .select("id, question_id, option_order, label, is_correct")
      .in("question_id", questionIds)
      .order("option_order", { ascending: true })
    : { data: [], error: null };

  if (optionsError) throw optionsError;

  const optionsByQuestionId = new Map<string, NonNullable<(typeof questions)[number]["options"]>>();
  for (const option of optionsData ?? []) {
    const existing = optionsByQuestionId.get(option.question_id) ?? [];
    existing.push(option);
    optionsByQuestionId.set(option.question_id, existing);
  }

  const issues = getAssessmentIssues(
    questions.map((question) => ({
      ...question,
      options: optionsByQuestionId.get(question.id) ?? [],
    })),
  ).filter((issue) => issue.severity === "error");

  if (issues.length > 0) {
    throw new Error(`Quiz cannot be published yet. ${issues.map((issue) => issue.message).join(" ")}`);
  }
}

async function syncLessonQuizStatus(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  lessonId: string,
  status: "draft" | "published" | "archived",
) {
  if (!lessonId) {
    return;
  }

  const { error } = await supabase
    .from("quizzes")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("lesson_id", lessonId);

  if (error) {
    throw error;
  }
}

export async function saveCourse(formData: FormData) {
  const input = requireValidForm(parseSaveCourseForm(formData));
  const courseId = input.courseId;
  const { supabase } = await requireAdmin();

  if (input.status === "published") {
    if (!courseId) {
      throw new ValidationError("Create the course as a draft before publishing from Review & Publish.");
    }
    await assertAdminCoursePublishReady(supabase, courseId);
  }

  const existingCourse = courseId
    ? await supabase
      .from("courses")
      .select("thumbnail")
      .eq("id", courseId)
      .maybeSingle()
    : { data: null, error: null };

  if (existingCourse.error) throw existingCourse.error;
  const existingCourseData = existingCourse.data as { thumbnail: StoredImagePayload } | null;

  const { data, error } = await supabase.rpc("admin_upsert_course", {
    p_course_id: courseId,
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_level: input.level,
    p_status: input.status,
    p_thumbnail: mergeImagePayload(
      input.thumbnail,
      existingCourseData?.thumbnail ?? null,
    ),
    p_sort_order: input.sortOrder,
    p_estimated_minutes: input.estimatedMinutes,
  });

  if (error) throw error;

  const result = data as { courseId?: string } | null;
  revalidatePath("/admin/courses");
  redirect(
    appendAdminNotice(
      `/admin/courses/${result?.courseId ?? courseId}`,
      "Course saved.",
    ),
  );
}

export async function saveLesson(formData: FormData) {
  const input = requireValidForm(parseSaveLessonForm(formData));
  const lessonId = input.lessonId;
  const courseId = input.courseId;
  const { supabase } = await requireAdmin();
  const requestedStatus = input.status;

  if (requestedStatus === "published") {
    await assertLessonPublishAllowed(supabase, lessonId);
  }

  const syncedLessonStatus = requestedStatus as "draft" | "published" | "archived";

  const { data, error } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: lessonId,
    p_course_id: courseId,
    p_title: input.title,
    p_description: input.description,
    p_cover_image: input.coverImage,
    p_status: requestedStatus,
    p_sort_order: input.sortOrder,
    p_estimated_minutes: input.estimatedMinutes,
    p_retry_mode: input.retryMode,
    p_retry_cooldown_seconds: input.retryCooldownSeconds,
    p_retry_requires_reread: input.retryRequiresReread,
    p_quiz_requires_lesson_completion: input.quizRequiresLessonCompletion,
    p_max_earning_attempts: input.maxEarningAttempts,
  });

  if (error) throw error;

  const result = data as { lessonId?: string } | null;
  const { error: syncError } = await supabase.rpc("admin_sync_course_estimated_minutes", {
    p_course_id: courseId,
  });

  if (syncError) throw syncError;

  await syncLessonQuizStatus(supabase, result?.lessonId ?? lessonId, syncedLessonStatus);

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  redirect(
    appendAdminNotice(
      `/admin/courses/lessons/${result?.lessonId ?? lessonId}`,
      lessonId ? "Lesson saved." : "Lesson created.",
    ),
  );
}

export async function setCourseStatus(formData: FormData) {
  const input = requireValidForm(parseSetCourseStatusForm(formData));
  const { courseId, redirectTo, status } = input;
  const { supabase } = await requireAdmin();

  if (status === "published") {
    await assertAdminCoursePublishReady(supabase, courseId);
  }

  const { error } = await supabase.rpc("admin_set_course_status", {
    p_course_id: courseId,
    p_status: status,
  });

  if (error) throw error;

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  redirect(
    appendAdminNotice(
      redirectTo,
      status === "published" ? "Course enabled." : "Course disabled.",
    ),
  );
}

export async function duplicateCourseShell(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();

  if (!courseId) {
    throw new ValidationError("Course is required.");
  }

  const { supabase } = await requireAdmin();
  const { data: sourceCourse, error: sourceError } = await supabase
    .from("courses")
    .select("id, title, description, category, level, thumbnail")
    .eq("id", courseId)
    .maybeSingle();

  if (sourceError) throw sourceError;

  const source = sourceCourse as {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    level: "beginner" | "intermediate" | "advanced";
    thumbnail: StoredImagePayload;
  } | null;

  if (!source) {
    throw new Error("Course not found.");
  }

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("sort_order");

  if (coursesError) throw coursesError;

  const nextSortOrder = ((courses ?? []) as Array<{ sort_order: number | null }>).reduce(
    (highest, course) => Math.max(highest, course.sort_order ?? 0),
    0,
  ) + 1;

  const { data, error } = await supabase.rpc("admin_upsert_course", {
    p_course_id: "",
    p_title: `Copy of ${source.title}`,
    p_description: source.description ?? "",
    p_category: source.category ?? "",
    p_level: source.level,
    p_status: "draft",
    p_thumbnail: source.thumbnail ?? {},
    p_sort_order: nextSortOrder,
    p_estimated_minutes: 0,
  });

  if (error) throw error;

  const result = data as { courseId?: string } | null;
  const duplicatedCourseId = result?.courseId;

  revalidatePath("/admin/courses");
  if (duplicatedCourseId) {
    revalidatePath(`/admin/courses/${duplicatedCourseId}`);
  }

  redirect(
    appendAdminNotice(
      duplicatedCourseId ? `/admin/courses/${duplicatedCourseId}` : "/admin/courses",
      "Course duplicated as a draft.",
    ),
  );
}

export async function setLessonStatus(formData: FormData) {
  const input = requireValidForm(parseSetLessonStatusForm(formData));
  const { courseId, lessonId, redirectTo, status } = input;
  const { supabase } = await requireAdmin();

  if (status === "published") {
    await assertLessonPublishAllowed(supabase, lessonId);
  }

  const { error } = await supabase.rpc("admin_set_lesson_status", {
    p_lesson_id: lessonId,
    p_status: status,
  });

  if (error) throw error;

  await syncLessonQuizStatus(supabase, lessonId, status);

  revalidatePath("/admin/courses");
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath("/courses");
  if (courseId) revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/dashboard");
  redirect(
    appendAdminNotice(
      redirectTo,
      status === "published" ? "Lesson enabled." : "Lesson disabled.",
    ),
  );
}

export async function archiveLessonFromCurriculum(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();

  if (!lessonId || !courseId) {
    throw new ValidationError("Course and lesson are required.");
  }

  const { supabase } = await requireAdmin();
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_id, title, description, cover_image, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (lessonError) throw lessonError;

  const lesson = lessonData as {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    cover_image: StoredImagePayload;
    sort_order: number;
    estimated_minutes: number;
    retry_mode: "anytime" | "cooldown" | "disabled";
    retry_cooldown_seconds: number | null;
    retry_requires_reread: boolean;
    quiz_requires_lesson_completion: boolean;
    max_earning_attempts: number | null;
  } | null;

  if (!lesson) {
    throw new Error("Lesson not found.");
  }

  const { error } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: lesson.id,
    p_course_id: lesson.course_id,
    p_title: lesson.title,
    p_description: lesson.description ?? "",
    p_cover_image: lesson.cover_image ?? {},
    p_status: "archived",
    p_sort_order: lesson.sort_order,
    p_estimated_minutes: lesson.estimated_minutes,
    p_retry_mode: lesson.retry_mode,
    p_retry_cooldown_seconds: lesson.retry_cooldown_seconds,
    p_retry_requires_reread: lesson.retry_requires_reread,
    p_quiz_requires_lesson_completion: lesson.quiz_requires_lesson_completion,
    p_max_earning_attempts: lesson.max_earning_attempts,
  });

  if (error) throw error;

  await syncLessonQuizStatus(supabase, lesson.id, "archived");

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/dashboard");
  redirect(
    appendAdminNotice(
      `/admin/courses/${courseId}?tab=curriculum`,
      "Lesson archived.",
    ),
  );
}

export async function reorderCourseLessons(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const rawLessonIds = String(formData.get("lessonIds") ?? "");

  if (!courseId) {
    throw new ValidationError("Course is required.");
  }

  let lessonIds: string[];
  try {
    const parsed = JSON.parse(rawLessonIds);
    lessonIds = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
  } catch {
    lessonIds = [];
  }

  if (lessonIds.length === 0) {
    throw new ValidationError("Lesson order is required.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reorder_course_lessons", {
    p_course_id: courseId,
    p_lesson_ids: lessonIds,
  });

  if (error) throw error;

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);

  return { ok: true };
}

export async function duplicateLessonFromCurriculum(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();

  if (!lessonId || !courseId) {
    throw new ValidationError("Course and lesson are required.");
  }

  const { supabase } = await requireAdmin();
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_id, title, description, cover_image, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (lessonError) throw lessonError;

  const lesson = lessonData as {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    cover_image: StoredImagePayload;
    sort_order: number;
    estimated_minutes: number;
    retry_mode: "anytime" | "cooldown" | "disabled";
    retry_cooldown_seconds: number | null;
    retry_requires_reread: boolean;
    quiz_requires_lesson_completion: boolean;
    max_earning_attempts: number | null;
  } | null;

  if (!lesson) {
    throw new Error("Lesson not found.");
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("sort_order")
    .eq("course_id", courseId);

  if (lessonsError) throw lessonsError;

  const nextSortOrder = ((lessons ?? []) as Array<{ sort_order: number | null }>).reduce(
    (highest, row) => Math.max(highest, row.sort_order ?? 0),
    0,
  ) + 1;

  const { data: newLessonData, error: newLessonError } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: "",
    p_course_id: courseId,
    p_title: `Copy of ${lesson.title}`,
    p_description: lesson.description ?? "",
    p_cover_image: lesson.cover_image ?? {},
    p_status: "draft",
    p_sort_order: nextSortOrder,
    p_estimated_minutes: lesson.estimated_minutes,
    p_retry_mode: lesson.retry_mode,
    p_retry_cooldown_seconds: lesson.retry_cooldown_seconds,
    p_retry_requires_reread: lesson.retry_requires_reread,
    p_quiz_requires_lesson_completion: lesson.quiz_requires_lesson_completion,
    p_max_earning_attempts: lesson.max_earning_attempts,
  });

  if (newLessonError) throw newLessonError;

  const newLessonId = (newLessonData as { lessonId?: string } | null)?.lessonId;
  if (!newLessonId) {
    throw new Error("Could not create duplicated lesson.");
  }

  const [pagesResult, quizResult] = await Promise.all([
    supabase
      .from("lesson_pages")
      .select("id, page_number, title, subtitle, page_type, cover_image")
      .eq("lesson_id", lessonId)
      .order("page_number", { ascending: true }),
    supabase
      .from("quizzes")
      .select("id, title, version")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
  ]);

  if (pagesResult.error) throw pagesResult.error;
  if (quizResult.error) throw quizResult.error;

  const sourcePages = (pagesResult.data ?? []) as Array<{
    id: string;
    page_number: number;
    title: string;
    subtitle: string | null;
    page_type: "primer" | "concept" | "example" | "reflection" | "summary";
    cover_image: StoredImagePayload;
  }>;
  const pageIdMap = new Map<string, string>();

  for (const page of sourcePages) {
    const newPageId = createCopyId("page", `${newLessonId}-${page.title}`);
    pageIdMap.set(page.id, newPageId);
    const { error: pageError } = await supabase.rpc("admin_upsert_lesson_page", {
      p_page_id: newPageId,
      p_lesson_id: newLessonId,
      p_title: page.title,
      p_subtitle: page.subtitle ?? "",
      p_page_type: page.page_type,
      p_page_number: page.page_number,
      p_cover_image: page.cover_image ?? {},
    });

    if (pageError) throw pageError;
  }

  const sourcePageIds = sourcePages.map((page) => page.id);
  const blocksResult = sourcePageIds.length > 0
    ? await supabase
      .from("lesson_content_blocks")
      .select("page_id, block_type, sort_order, payload")
      .in("page_id", sourcePageIds)
      .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (blocksResult.error) throw blocksResult.error;

  const sourceBlocks = (blocksResult.data ?? []) as Array<{
    page_id: string;
    block_type: "text" | "callout" | "image" | "video" | "audio" | "table";
    sort_order: number;
    payload: Record<string, unknown>;
  }>;

  for (const block of sourceBlocks) {
    const newPageId = pageIdMap.get(block.page_id);
    if (!newPageId) continue;

    const { error: blockError } = await supabase.rpc("admin_upsert_lesson_block", {
      p_block_id: null,
      p_page_id: newPageId,
      p_block_type: block.block_type,
      p_sort_order: block.sort_order,
      p_payload: block.payload,
    });

    if (blockError) throw blockError;
  }

  const sourceQuiz = quizResult.data as { id: string; title: string; version: number } | null;
  if (sourceQuiz) {
    const newQuizId = createCopyId("quiz", `${newLessonId}-${sourceQuiz.title}`);
    const { error: quizInsertError } = await supabase
      .from("quizzes")
      .insert({
        id: newQuizId,
        lesson_id: newLessonId,
        title: sourceQuiz.title,
        version: sourceQuiz.version,
        status: "draft",
      });

    if (quizInsertError) throw quizInsertError;

    const questionsResult = await supabase
      .from("quiz_questions")
      .select("id, question_order, question_type, prompt, explanation, xp")
      .eq("quiz_id", sourceQuiz.id)
      .order("question_order", { ascending: true });

    if (questionsResult.error) throw questionsResult.error;

    const sourceQuestions = (questionsResult.data ?? []) as Array<{
      id: string;
      question_order: number;
      question_type: "single_choice" | "multiple_choice" | "true_false";
      prompt: string;
      explanation: string | null;
      xp: number;
    }>;
    const sourceQuestionIds = sourceQuestions.map((question) => question.id);
    const optionsResult = sourceQuestionIds.length > 0
      ? await supabase
        .from("quiz_options")
        .select("question_id, option_order, label, is_correct")
        .in("question_id", sourceQuestionIds)
        .order("option_order", { ascending: true })
      : { data: [], error: null };

    if (optionsResult.error) throw optionsResult.error;

    const sourceOptions = (optionsResult.data ?? []) as Array<{
      question_id: string;
      option_order: number;
      label: string;
      is_correct: boolean;
    }>;

    for (const question of sourceQuestions) {
      const options = sourceOptions
        .filter((option) => option.question_id === question.id)
        .map((option) => ({
          isCorrect: option.is_correct,
          label: option.label,
          order: option.option_order,
        }));

      const { error: questionError } = await supabase.rpc("admin_upsert_quiz_question", {
        p_question_id: "",
        p_quiz_id: newQuizId,
        p_prompt: question.prompt,
        p_question_type: question.question_type,
        p_explanation: question.explanation ?? "",
        p_xp: question.xp,
        p_question_order: question.question_order,
        p_options: options,
      });

      if (questionError) throw questionError;
    }
  }

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/lessons/${newLessonId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  redirect(
    appendAdminNotice(
      `/admin/courses/lessons/${newLessonId}`,
      "Lesson duplicated as a draft.",
    ),
  );
}

export async function saveLessonPage(formData: FormData) {
  const input = requireValidForm(parseSaveLessonPageForm(formData));
  const lessonId = input.lessonId;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_upsert_lesson_page", {
    p_page_id: input.pageId,
    p_lesson_id: lessonId,
    p_title: input.title,
    p_subtitle: input.subtitle,
    p_page_type: input.pageType,
    p_page_number: input.pageNumber,
    p_cover_image: input.coverImage,
  });

  if (error) throw error;

  const result = data as { pageId?: string } | null;
  const pageId = result?.pageId;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(
    appendAdminNotice(
      `/admin/courses/lessons/${lessonId}${pageId ? `?page=${pageId}` : ""}`,
      "Page saved.",
    ),
  );
}

export async function saveLessonBlock(formData: FormData) {
  const input = requireValidForm(parseSaveLessonBlockForm(formData));
  const { blockId, lessonId, pageId } = input;
  const { supabase } = await requireAdmin();
  let resolvedSortOrder = input.sortOrder;

  if (blockId) {
    const { data: existingBlock, error: existingBlockError } = await supabase
      .from("lesson_content_blocks")
      .select("sort_order")
      .eq("id", blockId)
      .maybeSingle();

    if (existingBlockError) throw existingBlockError;
    if (existingBlock) {
      resolvedSortOrder = existingBlock.sort_order;
    }
  } else if (pageId) {
    const { data: lastBlock, error: lastBlockError } = await supabase
      .from("lesson_content_blocks")
      .select("sort_order")
      .eq("page_id", pageId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastBlockError) throw lastBlockError;
    resolvedSortOrder = (lastBlock?.sort_order ?? 0) + 1;
  }

  const { error } = await supabase.rpc("admin_upsert_lesson_block", {
    p_block_id: blockId || null,
    p_page_id: pageId,
    p_block_type: input.blockType,
    p_sort_order: resolvedSortOrder,
    p_payload: input.payload,
  });

  if (error?.code === "23505") {
    throw new Error("This block could not be saved because the page order changed. Refresh and try again.");
  }

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Block saved."));
}

export async function reorderLessonPage(formData: FormData) {
  const input = requireValidForm(parseReorderLessonPageForm(formData));
  const { direction, lessonId, pageId } = input;
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reorder_lesson_page", {
    p_lesson_id: lessonId,
    p_page_id: pageId,
    p_direction: direction,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(
    appendAdminNotice(`/admin/courses/lessons/${lessonId}?page=${pageId}`, "Page reordered."),
  );
}

export async function reorderLessonBlock(formData: FormData) {
  const input = requireValidForm(parseReorderLessonBlockForm(formData));
  const { blockId, direction, lessonId, pageId } = input;
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reorder_lesson_block", {
    p_page_id: pageId,
    p_block_id: blockId,
    p_direction: direction,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(
    appendAdminNotice(`/admin/courses/lessons/${lessonId}?page=${pageId}`, "Block reordered."),
  );
}

export async function saveQuizSettings(formData: FormData) {
  const input = requireValidForm(parseSaveQuizSettingsForm(formData));
  const lessonId = input.lessonId;
  const { supabase } = await requireAdmin();
  const quizId = input.quizId;
  const requestedStatus = input.status;

  if (requestedStatus === "published") {
    await assertQuizPublishAllowed(supabase, quizId);
    await assertQuizContentPublishReady(supabase, quizId);
  }

  const { error } = await supabase.rpc("admin_update_quiz", {
    p_quiz_id: quizId,
    p_title: input.quizTitle,
    p_status: requestedStatus,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Quiz settings saved."));
}

export async function reorderQuizQuestions(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const quizId = String(formData.get("quizId") ?? "").trim();
  const rawQuestionIds = String(formData.get("questionIds") ?? "");

  if (!lessonId || !quizId) {
    throw new ValidationError("Lesson and quiz are required.");
  }

  let questionIds: string[];
  try {
    const parsed = JSON.parse(rawQuestionIds);
    questionIds = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
  } catch {
    questionIds = [];
  }

  if (questionIds.length === 0) {
    throw new ValidationError("Question order is required.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reorder_quiz_questions", {
    p_quiz_id: quizId,
    p_question_ids: questionIds,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath(`/quiz/${lessonId}`);

  return { ok: true };
}

export async function deleteQuizQuestion(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const quizId = String(formData.get("quizId") ?? "").trim();
  const questionId = String(formData.get("questionId") ?? "").trim();

  if (!lessonId || !quizId || !questionId) {
    throw new ValidationError("Lesson, quiz and question are required.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_quiz_question", {
    p_quiz_id: quizId,
    p_question_id: questionId,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath(`/quiz/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Question deleted."));
}

export async function duplicateQuizQuestion(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const quizId = String(formData.get("quizId") ?? "").trim();
  const questionId = String(formData.get("questionId") ?? "").trim();

  if (!lessonId || !quizId || !questionId) {
    throw new ValidationError("Lesson, quiz and question are required.");
  }

  const { supabase } = await requireAdmin();
  const { data: questionData, error: questionError } = await supabase
    .from("quiz_questions")
    .select("id, quiz_id, question_order, question_type, prompt, explanation, xp")
    .eq("id", questionId)
    .eq("quiz_id", quizId)
    .maybeSingle();

  if (questionError) throw questionError;

  const question = questionData as {
    id: string;
    quiz_id: string;
    question_order: number;
    question_type: "single_choice" | "multiple_choice" | "true_false";
    prompt: string;
    explanation: string | null;
    xp: number;
  } | null;

  if (!question) {
    throw new Error("Question not found.");
  }

  const [optionsResult, questionsResult] = await Promise.all([
    supabase
      .from("quiz_options")
      .select("option_order, label, is_correct")
      .eq("question_id", question.id)
      .order("option_order", { ascending: true }),
    supabase
      .from("quiz_questions")
      .select("question_order")
      .eq("quiz_id", quizId),
  ]);

  if (optionsResult.error) throw optionsResult.error;
  if (questionsResult.error) throw questionsResult.error;

  const nextQuestionOrder = ((questionsResult.data ?? []) as Array<{ question_order: number | null }>).reduce(
    (highest, row) => Math.max(highest, row.question_order ?? 0),
    0,
  ) + 1;
  const options = ((optionsResult.data ?? []) as Array<{
    option_order: number;
    label: string;
    is_correct: boolean;
  }>).map((option) => ({
    isCorrect: option.is_correct,
    label: option.label,
    order: option.option_order,
  }));

  const { error } = await supabase.rpc("admin_upsert_quiz_question", {
    p_question_id: "",
    p_quiz_id: quizId,
    p_prompt: `Copy of ${question.prompt}`,
    p_question_type: question.question_type,
    p_explanation: question.explanation ?? "",
    p_xp: question.xp,
    p_question_order: nextQuestionOrder,
    p_options: options,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath(`/quiz/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Question duplicated."));
}

export async function saveQuizQuestion(formData: FormData) {
  const input = requireValidForm(parseSaveQuizQuestionForm(formData));
  const lessonId = input.lessonId;
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_upsert_quiz_question", {
    p_question_id: input.questionId,
    p_quiz_id: input.quizId,
    p_prompt: input.prompt,
    p_question_type: input.questionType,
    p_explanation: input.explanation,
    p_xp: input.xp,
    p_question_order: input.questionOrder,
    p_options: input.options,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Question saved."));
}
