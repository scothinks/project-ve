"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  formatValidationIssues,
  imagePayloadFromForm,
  parseSaveCourseForm,
  parseSaveLessonForm,
  parseSaveQuizQuestionForm,
  parseSaveQuizSettingsForm,
  parseSetCourseStatusForm,
  type ImagePayload,
} from "@/lib/admin-course-validation";
import { getAssessmentIssues } from "@/features/learning/admin/assessment-builder-domain";
import { assertAdminCoursePublishReady } from "@/features/learning/admin/course-readiness-data";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { ValidationError } from "@/lib/app-errors";
import type { ValidationIssue, ValidationResult } from "@/lib/request-validation";
import { revalidatePublishedLearningCourseCards } from "@/app/admin/courses/learning-cache";

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
  const returnToIndex = formData.get("returnTo") === "index";
  const { supabase, workspace } = await requireAdmin();

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
  const thumbnail = mergeImagePayload(
    input.thumbnail,
    existingCourseData?.thumbnail ?? null,
  );

  if (!courseId && workspace.type === "organization" && workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID) {
    const { data, error } = await supabase.rpc("admin_create_organization_private_course", {
      p_organization_id: workspace.id,
      p_title: input.title,
      p_description: input.description,
      p_intended_audience: input.intendedAudience,
      p_learning_outcomes: input.learningOutcomes,
      p_category: input.category,
      p_level: input.level,
      p_thumbnail: thumbnail,
      p_sort_order: input.sortOrder,
      p_estimated_minutes: input.estimatedMinutes,
    });

    if (error) throw error;

    const result = data as { courseId?: string } | null;
    revalidatePath("/admin/courses");
    redirect(
      appendAdminNotice(
        returnToIndex ? "/admin/courses" : `/admin/courses/${result?.courseId ?? ""}`,
        "Organisation-private course created.",
      ),
    );
  }

  const { data, error } = await supabase.rpc("admin_upsert_course", {
    p_course_id: courseId,
    p_title: input.title,
    p_description: input.description,
    p_intended_audience: input.intendedAudience,
    p_learning_outcomes: input.learningOutcomes,
    p_category: input.category,
    p_level: input.level,
    p_status: input.status,
    p_thumbnail: thumbnail,
    p_sort_order: input.sortOrder,
    p_estimated_minutes: input.estimatedMinutes,
  });

  if (error) throw error;

  const result = data as { courseId?: string } | null;
  revalidatePublishedLearningCourseCards();
  revalidatePath("/admin/courses");
  redirect(
    appendAdminNotice(
      returnToIndex ? "/admin/courses" : `/admin/courses/${result?.courseId ?? courseId}`,
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
  if (requestedStatus === "published") {
    const { error: publishError } = await supabase.rpc("admin_publish_lesson", {
      p_lesson_id: result?.lessonId ?? lessonId,
    });
    if (publishError) throw publishError;
  }

  const { error: syncError } = await supabase.rpc("admin_sync_course_estimated_minutes", {
    p_course_id: courseId,
  });

  if (syncError) throw syncError;

  await syncLessonQuizStatus(supabase, result?.lessonId ?? lessonId, syncedLessonStatus);

  revalidatePublishedLearningCourseCards();
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  redirect(
    appendAdminNotice(
      `/admin/courses/lessons/${result?.lessonId ?? lessonId}${formData.get("returnTo") === "quiz" ? "/quiz" : ""}`,
      lessonId ? "Lesson saved." : "Lesson created.",
    ),
  );
}

export async function saveLessonCover(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();

  if (!lessonId || !courseId) {
    throw new ValidationError("Course and lesson are required.");
  }

  const { supabase } = await requireAdmin();
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("title, description, status, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (lessonError) throw lessonError;

  const lesson = lessonData as {
    title: string;
    description: string | null;
    status: string;
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

  const issues: ValidationIssue[] = [];
  const coverImage = imagePayloadFromForm(formData, "coverImageUrl", "coverImageAlt", issues);

  if (issues.length > 0) {
    throw new ValidationError(`Invalid cover image. ${formatValidationIssues(issues)}`);
  }

  const { error } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: lessonId,
    p_course_id: courseId,
    p_title: lesson.title,
    p_description: lesson.description ?? "",
    p_cover_image: coverImage,
    p_status: lesson.status,
    p_sort_order: lesson.sort_order,
    p_estimated_minutes: lesson.estimated_minutes,
    p_retry_mode: lesson.retry_mode,
    p_retry_cooldown_seconds: lesson.retry_cooldown_seconds,
    p_retry_requires_reread: lesson.retry_requires_reread,
    p_quiz_requires_lesson_completion: lesson.quiz_requires_lesson_completion,
    p_max_earning_attempts: lesson.max_earning_attempts,
  });

  if (error) throw error;

  revalidatePublishedLearningCourseCards();
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  redirect(appendAdminNotice(`/admin/courses/${courseId}`, "Lesson cover updated."));
}

export async function createCurriculumLesson(formData: FormData) {
  const input = requireValidForm(parseSaveLessonForm(formData));
  const { courseId } = input;
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: "",
    p_course_id: courseId,
    p_title: input.title,
    p_description: input.description,
    p_cover_image: input.coverImage,
    p_status: "draft",
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
  const lessonId = result?.lessonId ?? "";

  const { error: syncError } = await supabase.rpc("admin_sync_course_estimated_minutes", {
    p_course_id: courseId,
  });

  if (syncError) throw syncError;

  await syncLessonQuizStatus(supabase, lessonId, "draft");

  revalidatePublishedLearningCourseCards();
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");

  return { lessonId };
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

  revalidatePublishedLearningCourseCards();
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
  const requestedTitle = String(formData.get("templateTitle") ?? "").trim();

  if (!courseId) {
    throw new ValidationError("Course is required.");
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_duplicate_course_template", {
    p_source_course_id: courseId,
    p_title: requestedTitle || null,
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

  revalidatePublishedLearningCourseCards();
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
  const { data, error } = await supabase.rpc("admin_duplicate_lesson", {
    p_lesson_id: lessonId,
    p_course_id: courseId,
  });
  if (error) throw error;
  const newLessonId = (data as { lessonId: string }).lessonId;

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

  revalidatePublishedLearningCourseCards();
  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/quiz`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/preview`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}/quiz`, "Quiz settings saved."));
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
  revalidatePath(`/admin/courses/lessons/${lessonId}/quiz`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/preview`);
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

  revalidatePublishedLearningCourseCards();
  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/quiz`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/preview`);
  revalidatePath(`/quiz/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}/quiz`, "Question deleted."));
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

  revalidatePublishedLearningCourseCards();
  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/quiz`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/preview`);
  revalidatePath(`/quiz/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}/quiz`, "Question duplicated."));
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

  revalidatePublishedLearningCourseCards();
  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/quiz`);
  revalidatePath(`/admin/courses/lessons/${lessonId}/preview`);
  if (formData.get("stayInEditor") !== "true") {
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}/quiz`, "Question saved."));
  }
}
