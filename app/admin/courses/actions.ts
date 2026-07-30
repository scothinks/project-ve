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
