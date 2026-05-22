"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function imagePayload(url: FormDataEntryValue | null, alt: FormDataEntryValue | null) {
  return {
    src: sanitizeUrlInput(String(url ?? ""), 1000) || undefined,
    alt: sanitizePlainTextInput(String(alt ?? ""), 240).trim() || undefined,
  };
}

function parseBlockPayload(formData: FormData) {
  const blockType = String(formData.get("blockType") ?? "text");

  if (blockType === "callout") {
    return {
      variant: sanitizePlainTextInput(String(formData.get("variant") ?? "key_point"), 40),
      title: sanitizePlainTextInput(String(formData.get("heading") ?? ""), 180),
      body: sanitizePlainTextInput(String(formData.get("body") ?? ""), 2000),
    };
  }

  if (blockType === "image") {
    return {
      src: sanitizeUrlInput(String(formData.get("src") ?? ""), 1000),
      alt: sanitizePlainTextInput(String(formData.get("alt") ?? ""), 240),
      caption: sanitizePlainTextInput(String(formData.get("caption") ?? ""), 500),
    };
  }

  if (blockType === "video" || blockType === "audio") {
    return {
      src: sanitizeUrlInput(String(formData.get("src") ?? ""), 1000),
      title: sanitizePlainTextInput(String(formData.get("heading") ?? ""), 180),
      caption: sanitizePlainTextInput(String(formData.get("caption") ?? ""), 500),
      transcript: sanitizePlainTextInput(String(formData.get("body") ?? ""), 2000),
    };
  }

  if (blockType === "table") {
    return {
      title: sanitizePlainTextInput(String(formData.get("heading") ?? ""), 180),
      columns: sanitizePlainTextInput(String(formData.get("columns") ?? ""), 500)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      rows: sanitizePlainTextInput(String(formData.get("rows") ?? ""), 2000)
        .split("\n")
        .map((row) => row.split(",").map((cell) => cell.trim()))
        .filter((row) => row.length > 0 && row.some(Boolean)),
      caption: sanitizePlainTextInput(String(formData.get("caption") ?? ""), 500),
    };
  }

  return {
    heading: sanitizePlainTextInput(String(formData.get("heading") ?? ""), 180),
    body: sanitizePlainTextInput(String(formData.get("body") ?? ""), 4000),
  };
}

function parseOptions(formData: FormData) {
  return [1, 2, 3, 4]
    .map((index) => ({
      label: sanitizePlainTextInput(String(formData.get(`option${index}`) ?? ""), 500),
      isCorrect: formData.get(`correct${index}`) === "on",
    }))
    .filter((option) => option.label.trim());
}

export async function saveCourse(formData: FormData) {
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_upsert_course", {
    p_course_id: courseId,
    p_title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 160),
    p_description: sanitizePlainTextInput(String(formData.get("description") ?? ""), 1000),
    p_category: sanitizePlainTextInput(String(formData.get("category") ?? ""), 120),
    p_level: String(formData.get("level") ?? "beginner"),
    p_status: String(formData.get("status") ?? "draft"),
    p_thumbnail: imagePayload(formData.get("thumbnailUrl"), formData.get("thumbnailAlt")),
    p_sort_order: parseInteger(formData.get("sortOrder")),
    p_estimated_minutes: parseInteger(formData.get("estimatedMinutes")),
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
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: lessonId,
    p_course_id: courseId,
    p_title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 160),
    p_description: sanitizePlainTextInput(String(formData.get("description") ?? ""), 1000),
    p_cover_image: imagePayload(formData.get("coverImageUrl"), formData.get("coverImageAlt")),
    p_status: String(formData.get("status") ?? "draft"),
    p_sort_order: parseInteger(formData.get("sortOrder")),
    p_estimated_minutes: parseInteger(formData.get("estimatedMinutes")),
    p_retry_mode: String(formData.get("retryMode") ?? "anytime"),
    p_retry_cooldown_seconds: parseOptionalInteger(formData.get("retryCooldownSeconds")),
    p_retry_requires_reread: formData.get("retryRequiresReread") === "on",
    p_quiz_requires_lesson_completion: formData.get("quizRequiresLessonCompletion") === "on",
    p_max_earning_attempts: parseOptionalInteger(formData.get("maxEarningAttempts")),
  });

  if (error) throw error;

  const result = data as { lessonId?: string } | null;
  const { error: syncError } = await supabase.rpc("admin_sync_course_estimated_minutes", {
    p_course_id: courseId,
  });

  if (syncError) throw syncError;

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
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const status = String(formData.get("status") ?? "draft") === "published" ? "published" : "draft";
  const redirectTo = sanitizePlainTextInput(
    String(formData.get("redirectTo") ?? `/admin/courses/${courseId}`),
    400,
  );
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
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const status = String(formData.get("status") ?? "draft") === "published" ? "published" : "draft";
  const redirectTo = sanitizePlainTextInput(
    String(formData.get("redirectTo") ?? `/admin/courses/${courseId}`),
    400,
  );
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_lesson_status", {
    p_lesson_id: lessonId,
    p_status: status,
  });

  if (error) throw error;

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
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_upsert_lesson_page", {
    p_page_id: sanitizePlainTextInput(String(formData.get("pageId") ?? ""), 120),
    p_lesson_id: lessonId,
    p_title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 160),
    p_subtitle: sanitizePlainTextInput(String(formData.get("subtitle") ?? ""), 300),
    p_page_type: String(formData.get("pageType") ?? "concept"),
    p_page_number: parseInteger(formData.get("pageNumber"), 1),
    p_cover_image: imagePayload(formData.get("coverImageUrl"), formData.get("coverImageAlt")),
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
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const blockId = sanitizePlainTextInput(String(formData.get("blockId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_upsert_lesson_block", {
    p_block_id: blockId || null,
    p_page_id: sanitizePlainTextInput(String(formData.get("pageId") ?? ""), 120),
    p_block_type: String(formData.get("blockType") ?? "text"),
    p_sort_order: parseInteger(formData.get("sortOrder")),
    p_payload: parseBlockPayload(formData),
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Block saved."));
}

export async function reorderLessonPage(formData: FormData) {
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const pageId = sanitizePlainTextInput(String(formData.get("pageId") ?? ""), 120);
  const direction = String(formData.get("direction") ?? "down") === "up" ? "up" : "down";
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
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const pageId = sanitizePlainTextInput(String(formData.get("pageId") ?? ""), 120);
  const blockId = sanitizePlainTextInput(String(formData.get("blockId") ?? ""), 120);
  const direction = String(formData.get("direction") ?? "down") === "up" ? "up" : "down";
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
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_update_quiz", {
    p_quiz_id: sanitizePlainTextInput(String(formData.get("quizId") ?? ""), 120),
    p_title: sanitizePlainTextInput(String(formData.get("quizTitle") ?? ""), 180),
    p_status: String(formData.get("quizStatus") ?? "draft"),
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Quiz settings saved."));
}

export async function saveQuizQuestion(formData: FormData) {
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const options = parseOptions(formData);

  if (!options.some((option) => option.isCorrect)) {
    throw new Error("Mark at least one correct answer.");
  }

  const { error } = await supabase.rpc("admin_upsert_quiz_question", {
    p_question_id: sanitizePlainTextInput(String(formData.get("questionId") ?? ""), 160),
    p_quiz_id: sanitizePlainTextInput(String(formData.get("quizId") ?? ""), 120),
    p_prompt: sanitizePlainTextInput(String(formData.get("prompt") ?? ""), 1000),
    p_question_type: String(formData.get("questionType") ?? "single_choice"),
    p_explanation: sanitizePlainTextInput(String(formData.get("explanation") ?? ""), 1000),
    p_xp: parseInteger(formData.get("xp"), 1),
    p_question_order: parseInteger(formData.get("questionOrder"), 1),
    p_options: options,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Question saved."));
}
