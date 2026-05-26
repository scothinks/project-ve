"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";

type AiPublishGuardRow = {
  ai_generated: boolean;
  ai_publish_status: string | null;
};

type StoredImagePayload = Record<string, unknown> | null;

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeImagePayload(
  url: FormDataEntryValue | null,
  alt: FormDataEntryValue | null,
  existing?: StoredImagePayload,
) {
  const next = imagePayload(url, alt);
  const current = asRecord(existing);

  return {
    ...("fit" in current ? { fit: current.fit } : {}),
    ...("positionX" in current ? { positionX: current.positionX } : {}),
    ...("positionY" in current ? { positionY: current.positionY } : {}),
    ...("caption" in current ? { caption: current.caption } : {}),
    ...next,
  };
}

function parseBlockPayload(formData: FormData) {
  const blockType = String(formData.get("blockType") ?? "text");

  if (blockType === "callout") {
    return {
      variant: sanitizePlainTextInput(String(formData.get("variant") ?? "key_point"), 40),
      label: sanitizePlainTextInput(String(formData.get("label") ?? ""), 80),
      title: sanitizePlainTextInput(String(formData.get("heading") ?? ""), 180),
      body: sanitizePlainTextInput(String(formData.get("body") ?? ""), 2000),
    };
  }

  if (blockType === "image") {
    const payload: Record<string, unknown> = {
      src: sanitizeUrlInput(String(formData.get("src") ?? ""), 1000),
      alt: sanitizePlainTextInput(String(formData.get("alt") ?? ""), 240),
      caption: sanitizePlainTextInput(String(formData.get("caption") ?? ""), 500),
    };

    const aiManagedByAssetId = sanitizePlainTextInput(String(formData.get("aiManagedByAssetId") ?? ""), 120);
    const aiManagedKind = sanitizePlainTextInput(String(formData.get("aiManagedKind") ?? ""), 80);
    const aiGenerated = String(formData.get("aiGenerated") ?? "").trim().toLowerCase();

    if (aiManagedByAssetId) {
      payload.aiManagedByAssetId = aiManagedByAssetId;
    }

    if (aiManagedKind) {
      payload.aiManagedKind = aiManagedKind;
    }

    if (aiGenerated === "true" || aiGenerated === "1" || aiGenerated === "yes" || aiGenerated === "on") {
      payload.aiGenerated = true;
    }

    return payload;
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

function normalizeRequestedPublishStatus(
  rawStatus: FormDataEntryValue | null,
  allowedStatuses: readonly string[],
  fallback: string,
) {
  const nextStatus = String(rawStatus ?? fallback);
  return allowedStatuses.includes(nextStatus) ? nextStatus : fallback;
}

function aiPublishReady(status: string | null | undefined) {
  return status === "ready" || status === "published";
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
    .maybeSingle<
      AiPublishGuardRow & {
        course:
          | {
              ai_generated: boolean;
              ai_publish_status: string | null;
            }
          | null;
      }
    >();

  if (error) throw error;
  if (!data || !data.ai_generated) {
    return;
  }

  if (!aiPublishReady(data.ai_publish_status)) {
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
    .maybeSingle<{
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
    }>();

  if (error) throw error;
  if (!data || !data.ai_generated) {
    return;
  }

  const lessonBlocked = Boolean(
    data.lesson?.ai_generated && !aiPublishReady(data.lesson.ai_publish_status),
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
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const customCategory = sanitizePlainTextInput(String(formData.get("categoryCustom") ?? ""), 120);
  const selectedCategory = sanitizePlainTextInput(String(formData.get("category") ?? ""), 120);
  const resolvedCategory = customCategory.trim() || selectedCategory.trim();
  const requestedStatus = normalizeRequestedPublishStatus(
    formData.get("status"),
    ["draft", "published", "archived"],
    "draft",
  );

  const existingCourse = courseId
    ? await supabase
      .from("courses")
      .select("thumbnail")
      .eq("id", courseId)
      .maybeSingle<{ thumbnail: StoredImagePayload }>()
    : { data: null, error: null };

  if (existingCourse.error) throw existingCourse.error;

  const { data, error } = await supabase.rpc("admin_upsert_course", {
    p_course_id: courseId,
    p_title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 160),
    p_description: sanitizePlainTextInput(String(formData.get("description") ?? ""), 1000),
    p_category: resolvedCategory,
    p_level: String(formData.get("level") ?? "beginner"),
    p_status: requestedStatus,
    p_thumbnail: mergeImagePayload(
      formData.get("thumbnailUrl"),
      formData.get("thumbnailAlt"),
      existingCourse.data?.thumbnail ?? null,
    ),
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
  const requestedStatus = normalizeRequestedPublishStatus(
    formData.get("status"),
    ["draft", "published", "archived"],
    "draft",
  );

  if (requestedStatus === "published") {
    await assertLessonPublishAllowed(supabase, lessonId);
  }

  const syncedLessonStatus = requestedStatus as "draft" | "published" | "archived";

  const { data, error } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: lessonId,
    p_course_id: courseId,
    p_title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 160),
    p_description: sanitizePlainTextInput(String(formData.get("description") ?? ""), 1000),
    p_cover_image: imagePayload(formData.get("coverImageUrl"), formData.get("coverImageAlt")),
    p_status: requestedStatus,
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
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const status: "published" | "draft" =
    String(formData.get("status") ?? "draft") === "published" ? "published" : "draft";
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
  const status: "published" | "draft" =
    String(formData.get("status") ?? "draft") === "published" ? "published" : "draft";
  const redirectTo = sanitizePlainTextInput(
    String(formData.get("redirectTo") ?? `/admin/courses/${courseId}`),
    400,
  );
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
  const pageId = sanitizePlainTextInput(String(formData.get("pageId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  let resolvedSortOrder = parseInteger(formData.get("sortOrder"));

  if (blockId) {
    const { data: existingBlock, error: existingBlockError } = await supabase
      .from("lesson_content_blocks")
      .select("sort_order")
      .eq("id", blockId)
      .maybeSingle<{ sort_order: number }>();

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
      .maybeSingle<{ sort_order: number }>();

    if (lastBlockError) throw lastBlockError;
    resolvedSortOrder = (lastBlock?.sort_order ?? 0) + 1;
  }

  const { error } = await supabase.rpc("admin_upsert_lesson_block", {
    p_block_id: blockId || null,
    p_page_id: pageId,
    p_block_type: String(formData.get("blockType") ?? "text"),
    p_sort_order: resolvedSortOrder,
    p_payload: parseBlockPayload(formData),
  });

  if (error?.code === "23505") {
    throw new Error("This block could not be saved because the page order changed. Refresh and try again.");
  }

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
  const quizId = sanitizePlainTextInput(String(formData.get("quizId") ?? ""), 120);
  const requestedStatus = normalizeRequestedPublishStatus(
    formData.get("quizStatus"),
    ["draft", "published", "archived"],
    "draft",
  );

  if (requestedStatus === "published") {
    await assertQuizPublishAllowed(supabase, quizId);
  }

  const { error } = await supabase.rpc("admin_update_quiz", {
    p_quiz_id: quizId,
    p_title: sanitizePlainTextInput(String(formData.get("quizTitle") ?? ""), 180),
    p_status: requestedStatus,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Quiz settings saved."));
}

export async function saveQuizQuestion(formData: FormData) {
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const options = parseOptions(formData);

  if (options.length < 2 || options.length > 4) {
    throw new Error("Provide between 2 and 4 answer options.");
  }

  if (!options.some((option) => option.isCorrect)) {
    throw new Error("Mark at least one correct answer.");
  }

  const { error } = await supabase.rpc("admin_upsert_quiz_question", {
    p_question_id: sanitizePlainTextInput(String(formData.get("questionId") ?? ""), 160),
    p_quiz_id: sanitizePlainTextInput(String(formData.get("quizId") ?? ""), 120),
    p_prompt: sanitizePlainTextInput(String(formData.get("prompt") ?? ""), 1000),
    p_question_type: String(formData.get("questionType") ?? "single_choice"),
    p_explanation: sanitizePlainTextInput(String(formData.get("explanation") ?? ""), 1000),
    p_xp: clampInteger(parseInteger(formData.get("xp"), 1), 1, 20),
    p_question_order: parseInteger(formData.get("questionOrder"), 1),
    p_options: options,
  });

  if (error) throw error;

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(appendAdminNotice(`/admin/courses/lessons/${lessonId}`, "Question saved."));
}
