"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import {
  clampAiGenerationRequest,
  generateAiCourseDraft as generateAiCourseDraftFromModel,
  getAiLearningConfig,
  type AiCourseGenerationInput,
  type AiGeneratedBlock,
  type AiGeneratedCourseDraft,
} from "@/lib/ai-learning-generator";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";

type WorkflowCourseRow = {
  id: string;
  title: string;
  status: string;
  ai_generated: boolean;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
};

type WorkflowLessonRow = {
  id: string;
  course_id: string;
  title: string;
  ai_generated: boolean;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
};

type WorkflowQuizRow = {
  id: string;
  lesson_id: string;
  title: string;
  ai_generated: boolean;
  ai_text_status: string;
  status: string;
};

type WorkflowMediaAssetRow = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  review_status: string;
};

function slugify(value: string) {
  return sanitizePlainTextInput(value, 160)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function createTextId(prefix: string, value: string) {
  const base = slugify(value);
  return `${prefix}-${base}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
}

function parseInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAiGenerationInput(formData: FormData): AiCourseGenerationInput {
  return clampAiGenerationRequest({
    topic: sanitizePlainTextInput(String(formData.get("topic") ?? ""), 160),
    audience: sanitizePlainTextInput(String(formData.get("audience") ?? ""), 160),
    region: sanitizePlainTextInput(String(formData.get("region") ?? ""), 120),
    difficulty:
      String(formData.get("difficulty") ?? "beginner") === "advanced"
        ? "advanced"
        : String(formData.get("difficulty") ?? "beginner") === "intermediate"
          ? "intermediate"
          : "beginner",
    tone: sanitizePlainTextInput(String(formData.get("tone") ?? ""), 120),
    lessonCount: parseInteger(formData.get("lessonCount"), 4),
    questionsPerLesson: parseInteger(formData.get("questionsPerLesson"), 3),
    notes: sanitizePlainTextInput(String(formData.get("notes") ?? ""), 4000),
  });
}

function mapAiPageTypeToDb(pageType: string) {
  return pageType === "scenario" ? "example" : pageType;
}

function mapAiBlockToDb(block: AiGeneratedBlock): {
  block_type: "text" | "callout" | "table";
  payload: Record<string, unknown>;
} {
  if (block.blockType === "callout") {
    return {
      block_type: "callout",
      payload: {
        variant: sanitizePlainTextInput(String(block.payload.variant ?? "key_point"), 24) || "key_point",
        title: sanitizePlainTextInput(String(block.payload.title ?? ""), 180),
        body: sanitizePlainTextInput(String(block.payload.body ?? ""), 2000),
      },
    };
  }

  if (block.blockType === "table") {
    const columns = Array.isArray(block.payload.columns)
      ? block.payload.columns.map((column) => sanitizePlainTextInput(String(column), 60)).filter(Boolean)
      : [];
    const rows = Array.isArray(block.payload.rows)
      ? block.payload.rows
          .map((row) =>
            Array.isArray(row)
              ? row.map((cell) => sanitizePlainTextInput(String(cell), 120)).filter(Boolean)
              : [],
          )
          .filter((row) => row.length > 0)
      : [];

    return {
      block_type: "table",
      payload: {
        title: sanitizePlainTextInput(String(block.payload.title ?? ""), 180),
        columns,
        rows,
        caption: sanitizePlainTextInput(String(block.payload.caption ?? ""), 500),
      },
    };
  }

  if (block.blockType === "image" || block.blockType === "video" || block.blockType === "audio") {
    const label = block.blockType === "image" ? "Suggested media" : `Suggested ${block.blockType}`;
    return {
      block_type: "callout",
      payload: {
        variant: "example",
        title:
          sanitizePlainTextInput(
            String(block.payload.title ?? block.payload.caption ?? block.payload.alt ?? label),
            180,
          ) || label,
        body:
          sanitizePlainTextInput(
            String(
              block.payload.transcript
                ?? block.payload.caption
                ?? block.payload.alt
                ?? "Media will be reviewed and attached after text approval.",
            ),
            2000,
          ) || "Media will be reviewed and attached after text approval.",
      },
    };
  }

  return {
    block_type: "text",
    payload: {
      heading: sanitizePlainTextInput(String(block.payload.heading ?? ""), 180),
      body: sanitizePlainTextInput(String(block.payload.body ?? ""), 3000),
    },
  };
}

function buildCourseNotes(
  input: AiCourseGenerationInput,
  jobId: string | null,
  draft: AiGeneratedCourseDraft,
) {
  const config = getAiLearningConfig();
  return {
    source: "openai",
    jobId,
    textModel: config.textModel,
    reviewModel: config.reviewModel,
    generatedFrom: input,
    lessonCount: draft.lessons.length,
  };
}

function revalidateLearningPaths(courseId: string, lessonIds: string[]) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  for (const lessonId of lessonIds) {
    revalidatePath(`/admin/courses/lessons/${lessonId}`);
    revalidatePath(`/lessons/${lessonId}`);
    revalidatePath(`/quiz/${lessonId}`);
  }
}

async function insertAuditEvent(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  actorUserId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_events").insert({
    actor_user_id: actorUserId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });

  if (error) {
    throw error;
  }
}

async function getCourseWorkflowData(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
) {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title, status, ai_generated, ai_text_status, ai_media_status, ai_publish_status")
    .eq("id", courseId)
    .maybeSingle<WorkflowCourseRow>();

  if (courseError) throw courseError;
  if (!course) {
    throw new Error("Course not found.");
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, course_id, title, ai_generated, ai_text_status, ai_media_status, ai_publish_status")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<WorkflowLessonRow[]>();

  if (lessonsError) throw lessonsError;

  const lessonIds = (lessons ?? []).map((lesson) => lesson.id);
  let quizzes: WorkflowQuizRow[] = [];

  if (lessonIds.length > 0) {
    const { data: quizRows, error: quizzesError } = await supabase
      .from("quizzes")
      .select("id, lesson_id, title, ai_generated, ai_text_status, status")
      .in("lesson_id", lessonIds)
      .returns<WorkflowQuizRow[]>();

    if (quizzesError) throw quizzesError;
    quizzes = quizRows ?? [];
  }

  return { course, lessons: lessons ?? [], quizzes };
}

function ensureAiCourse(course: WorkflowCourseRow) {
  if (!course.ai_generated) {
    throw new Error("This workflow only applies to AI-generated courses.");
  }
}

function getRedirectTarget(formData: FormData, fallback: string) {
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? fallback), 400);
  return redirectTo || fallback;
}

async function createJob(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  actorUserId: string,
  jobType: "course_text" | "media_assets",
  prompt: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .insert({
      entity_type: "course",
      entity_id: null,
      job_type: jobType,
      status: "running",
      prompt,
      result: {},
      created_by: actorUserId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throw error;
  return data.id;
}

async function updateJob(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase.from("ai_generation_jobs").update(patch).eq("id", jobId);
  if (error) throw error;
}

export async function generateAiCourseDraft(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, profile } = admin;
  const input = parseAiGenerationInput(formData);

  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new Error("Topic, target audience, country or region, and tone are required.");
  }

  let jobId: string | null = null;
  let courseId: string | null = null;

  try {
    jobId = await createJob(supabase, profile.id, "course_text", input);
    const draft = await generateAiCourseDraftFromModel(input);
    const courseSlugBase = slugify(draft.course.title);
    const courseSlug = `${courseSlugBase}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
    courseId = createTextId("course", courseSlug);
    const lessonRows: Array<Record<string, unknown>> = [];
    const pageRows: Array<Record<string, unknown>> = [];
    const blockRows: Array<Record<string, unknown>> = [];
    const quizRows: Array<Record<string, unknown>> = [];
    const questionRows: Array<Record<string, unknown>> = [];
    const optionRows: Array<Record<string, unknown>> = [];
    const mediaRows: Array<Record<string, unknown>> = [];
    const lessonIds: string[] = [];

    for (const [lessonIndex, lesson] of draft.lessons.entries()) {
      const lessonId = createTextId("lesson", lesson.title);
      const quizId = `quiz-${lessonId.replace(/^lesson-/, "")}`;
      lessonIds.push(lessonId);
      lessonRows.push({
        id: lessonId,
        course_id: courseId,
        slug: `${slugify(lesson.title)}-${lessonIndex + 1}`,
        title: lesson.title,
        description: lesson.description,
        cover_image: {},
        status: "draft",
        sort_order: lessonIndex + 1,
        estimated_minutes: lesson.estimatedMinutes,
        retry_mode: "anytime",
        retry_cooldown_seconds: null,
        retry_requires_reread: true,
        quiz_requires_lesson_completion: true,
        max_earning_attempts: null,
        ai_text_status: "draft",
        ai_media_status: "not_started",
        ai_publish_status: "not_ready",
        ai_generated: true,
        ai_generation_notes: {
          source: "openai",
          jobId,
          lessonIndex: lessonIndex + 1,
        },
      });

      quizRows.push({
        id: quizId,
        lesson_id: lessonId,
        title: lesson.quiz.title,
        version: 1,
        status: "draft",
        ai_text_status: "draft",
        ai_generated: true,
        ai_generation_notes: {
          source: "openai",
          jobId,
          lessonId,
        },
      });

      for (const [pageIndex, page] of lesson.pages.entries()) {
        const pageId = createTextId("page", `${lesson.title}-${page.title}`);
        pageRows.push({
          id: pageId,
          lesson_id: lessonId,
          page_number: pageIndex + 1,
          title: page.title,
          subtitle: page.subtitle,
          page_type: mapAiPageTypeToDb(page.pageType),
          cover_image: {},
        });

        for (const [blockIndex, block] of page.blocks.entries()) {
          const mapped = mapAiBlockToDb(block);
          blockRows.push({
            id: crypto.randomUUID(),
            page_id: pageId,
            block_type: mapped.block_type,
            sort_order: blockIndex + 1,
            payload: mapped.payload,
          });
        }
      }

      for (const [questionIndex, question] of lesson.quiz.questions.entries()) {
        const questionId = createTextId("question", `${lesson.title}-${question.prompt}`);
        questionRows.push({
          id: questionId,
          quiz_id: quizId,
          question_order: questionIndex + 1,
          question_type: "single_choice",
          prompt: question.prompt,
          explanation: question.explanation,
          xp: question.xp,
        });

        for (const [optionIndex, option] of question.options.entries()) {
          optionRows.push({
            id: `${questionId}-option-${optionIndex + 1}`,
            question_id: questionId,
            option_order: optionIndex + 1,
            label: option.label,
            is_correct: option.isCorrect,
          });
        }
      }

      for (const [mediaIndex, mediaBrief] of lesson.mediaBriefs.entries()) {
        mediaRows.push({
          course_id: courseId,
          lesson_id: lessonId,
          asset_type: mediaBrief.assetType,
          placement: mediaBrief.placement,
          source: "ai_generated",
          prompt: mediaBrief.prompt,
          script: mediaBrief.script,
          url: null,
          alt_text: mediaBrief.altText,
          caption: mediaBrief.caption,
          metadata: {
            jobId,
            lessonId,
            lessonTitle: lesson.title,
          },
          review_status: "draft",
          sort_order: mediaIndex,
        });
      }
    }

    const courseRow = {
      id: courseId,
      slug: courseSlug,
      title: draft.course.title,
      description: draft.course.description,
      category: draft.course.category,
      level: draft.course.level,
      thumbnail: {},
      status: "draft",
      sort_order: 0,
      estimated_minutes: draft.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0),
      ai_text_status: "draft",
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      ai_generated: true,
      ai_generation_notes: buildCourseNotes(input, jobId, draft),
    };

    const { error: courseError } = await supabase.from("courses").insert(courseRow);
    if (courseError) throw courseError;

    const { error: lessonsError } = await supabase.from("lessons").insert(lessonRows);
    if (lessonsError) throw lessonsError;

    const { error: pagesError } = await supabase.from("lesson_pages").insert(pageRows);
    if (pagesError) throw pagesError;

    const { error: blocksError } = await supabase.from("lesson_content_blocks").insert(blockRows);
    if (blocksError) throw blocksError;

    const { error: quizzesError } = await supabase.from("quizzes").insert(quizRows);
    if (quizzesError) throw quizzesError;

    const { error: questionsError } = await supabase.from("quiz_questions").insert(questionRows);
    if (questionsError) throw questionsError;

    const { error: optionsError } = await supabase.from("quiz_options").insert(optionRows);
    if (optionsError) throw optionsError;

    if (mediaRows.length > 0) {
      const { error: mediaError } = await supabase.from("learning_media_assets").insert(mediaRows);
      if (mediaError) throw mediaError;
    }

    await updateJob(supabase, jobId, {
      entity_id: courseId,
      status: "completed",
      result: {
        courseId,
        title: draft.course.title,
        lessonCount: draft.lessons.length,
        mediaAssetCount: mediaRows.length,
      },
      error: null,
    });

    await insertAuditEvent(supabase, profile.id, "ai_course_draft_generated", "course", courseId, {
      topic: input.topic,
      audience: input.audience,
      region: input.region,
      lessonCount: draft.lessons.length,
      questionsPerLesson: input.questionsPerLesson,
      jobId,
    });

    revalidateLearningPaths(courseId, lessonIds);
    redirect(
      appendAdminNotice(`/admin/courses/${courseId}`, "AI course draft created. Review the text before media generation."),
    );
  } catch (error) {
    if (courseId) {
      await supabase.from("courses").delete().eq("id", courseId);
    }

    if (jobId) {
      await updateJob(supabase, jobId, {
        entity_id: courseId,
        status: "failed",
        error: error instanceof Error ? error.message : "AI course draft generation failed.",
      }).catch(() => undefined);
    }

    throw error;
  }
}

export async function approveCourseText(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  const approvedAt = new Date().toISOString();

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      ai_text_status: "approved",
      ai_media_status: "generation_ready",
      ai_publish_status: "not_ready",
      text_approved_at: approvedAt,
      text_approved_by: profile.id,
    })
    .eq("id", courseId);

  if (courseError) throw courseError;

  if (lessons.length > 0) {
    const lessonIds = lessons.map((lesson) => lesson.id);
    const { error: lessonsError } = await supabase
      .from("lessons")
      .update({
        ai_text_status: "approved",
        ai_media_status: "generation_ready",
        ai_publish_status: "not_ready",
        text_approved_at: approvedAt,
        text_approved_by: profile.id,
      })
      .in("id", lessonIds);

    if (lessonsError) throw lessonsError;

    const { error: quizzesError } = await supabase
      .from("quizzes")
      .update({
        ai_text_status: "approved",
        text_approved_at: approvedAt,
        text_approved_by: profile.id,
      })
      .in("lesson_id", lessonIds);

    if (quizzesError) throw quizzesError;
  }

  await insertAuditEvent(supabase, profile.id, "ai_course_text_approved", "course", courseId, {
    approvedAt,
  });

  revalidateLearningPaths(courseId, lessons.map((lesson) => lesson.id));
  redirect(appendAdminNotice(redirectTo, "Course text approved. Media generation is now unlocked."));
}

export async function requestCourseTextChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  const { error } = await supabase.rpc("admin_reset_ai_course_tree", {
    p_course_id: courseId,
    p_text_status: "changes_requested",
  });

  if (error) throw error;

  await insertAuditEvent(supabase, profile.id, "ai_course_text_changes_requested", "course", courseId, {});

  revalidateLearningPaths(courseId, lessons.map((lesson) => lesson.id));
  redirect(appendAdminNotice(redirectTo, "Text changes requested. Media generation has been locked again."));
}

export async function generateCourseMediaDrafts(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (course.ai_text_status !== "approved") {
    throw new Error("Approve the course text before generating media drafts.");
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  const { data: assets, error: assetsError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, review_status")
    .eq("course_id", courseId)
    .returns<WorkflowMediaAssetRow[]>();

  if (assetsError) throw assetsError;

  let jobId: string | null = null;
  try {
    jobId = await createJob(supabase, profile.id, "media_assets", { courseId });

    if ((assets ?? []).length === 0) {
      const fallbackRows = lessons.map((lesson, index) => ({
        course_id: courseId,
        lesson_id: lesson.id,
        asset_type: "image",
        placement: `lesson_${index + 1}_intro`,
        source: "ai_generated",
        prompt: `Create a culturally neutral supporting illustration for the lesson "${lesson.title}".`,
        script: "",
        url: null,
        alt_text: `${lesson.title} illustration`,
        caption: lesson.title,
        metadata: { jobId, lessonId: lesson.id, autoCreated: true },
        review_status: "draft",
        sort_order: index,
      }));

      const { error: insertError } = await supabase.from("learning_media_assets").insert(fallbackRows);
      if (insertError) throw insertError;
    } else {
      const assetIds = (assets ?? []).map((asset) => asset.id);
      const { error: mediaResetError } = await supabase
        .from("learning_media_assets")
        .update({
          review_status: "draft",
        })
        .in("id", assetIds);

      if (mediaResetError) throw mediaResetError;
    }

    const { error: courseUpdateError } = await supabase
      .from("courses")
      .update({
        ai_media_status: "draft",
        ai_publish_status: "not_ready",
      })
      .eq("id", courseId);

    if (courseUpdateError) throw courseUpdateError;

    if (lessonIds.length > 0) {
      const { error: lessonsUpdateError } = await supabase
        .from("lessons")
        .update({
          ai_media_status: "draft",
          ai_publish_status: "not_ready",
        })
        .in("id", lessonIds);

      if (lessonsUpdateError) throw lessonsUpdateError;
    }

    if (jobId) {
      await updateJob(supabase, jobId, {
        entity_id: courseId,
        status: "completed",
        result: {
          courseId,
          lessonCount: lessons.length,
          assetCount: (assets ?? []).length,
        },
        error: null,
      });
    }

    await insertAuditEvent(supabase, profile.id, "ai_course_media_drafts_generated", "course", courseId, {
      jobId,
    });

    revalidateLearningPaths(courseId, lessonIds);
    redirect(appendAdminNotice(redirectTo, "Media drafts prepared. Review and approve them before publishing."));
  } catch (error) {
    if (jobId) {
      await updateJob(supabase, jobId, {
        entity_id: courseId,
        status: "failed",
        error: error instanceof Error ? error.message : "Media draft generation failed.",
      }).catch(() => undefined);
    }

    throw error;
  }
}

export async function approveCourseMedia(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (course.ai_text_status !== "approved") {
    throw new Error("Approve the course text before approving media.");
  }

  const approvedAt = new Date().toISOString();
  const lessonIds = lessons.map((lesson) => lesson.id);

  const { error: assetsError } = await supabase
    .from("learning_media_assets")
    .update({ review_status: "approved" })
    .eq("course_id", courseId);

  if (assetsError) throw assetsError;

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      ai_media_status: "approved",
      ai_publish_status: "ready",
      media_approved_at: approvedAt,
      media_approved_by: profile.id,
    })
    .eq("id", courseId);

  if (courseError) throw courseError;

  if (lessonIds.length > 0) {
    const { error: lessonsError } = await supabase
      .from("lessons")
      .update({
        ai_media_status: "approved",
        ai_publish_status: "ready",
        media_approved_at: approvedAt,
        media_approved_by: profile.id,
      })
      .in("id", lessonIds);

    if (lessonsError) throw lessonsError;
  }

  await insertAuditEvent(supabase, profile.id, "ai_course_media_approved", "course", courseId, {
    approvedAt,
  });

  revalidateLearningPaths(courseId, lessonIds);
  redirect(appendAdminNotice(redirectTo, "Media approved. Publishing is now unlocked."));
}

export async function requestCourseMediaChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  const lessonIds = lessons.map((lesson) => lesson.id);

  const { error: assetsError } = await supabase
    .from("learning_media_assets")
    .update({ review_status: "changes_requested" })
    .eq("course_id", courseId);

  if (assetsError) throw assetsError;

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      ai_media_status: "changes_requested",
      ai_publish_status: "not_ready",
      media_approved_at: null,
      media_approved_by: null,
    })
    .eq("id", courseId);

  if (courseError) throw courseError;

  if (lessonIds.length > 0) {
    const { error: lessonsError } = await supabase
      .from("lessons")
      .update({
        ai_media_status: "changes_requested",
        ai_publish_status: "not_ready",
        media_approved_at: null,
        media_approved_by: null,
      })
      .in("id", lessonIds);

    if (lessonsError) throw lessonsError;
  }

  await insertAuditEvent(supabase, profile.id, "ai_course_media_changes_requested", "course", courseId, {});

  revalidateLearningPaths(courseId, lessonIds);
  redirect(appendAdminNotice(redirectTo, "Media changes requested. Publishing has been locked again."));
}

export async function publishApprovedCourse(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (
    course.ai_text_status !== "approved"
    || course.ai_media_status !== "approved"
    || course.ai_publish_status !== "ready"
  ) {
    throw new Error("This course is not ready to publish. Text and media must both be approved first.");
  }

  const lessonIds = lessons.map((lesson) => lesson.id);

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      status: "published",
      ai_publish_status: "published",
    })
    .eq("id", courseId);

  if (courseError) throw courseError;

  if (lessonIds.length > 0) {
    const { error: lessonsError } = await supabase
      .from("lessons")
      .update({
        status: "published",
        ai_publish_status: "published",
      })
      .in("id", lessonIds);

    if (lessonsError) throw lessonsError;

    const { error: quizzesError } = await supabase
      .from("quizzes")
      .update({
        status: "published",
      })
      .in("lesson_id", lessonIds);

    if (quizzesError) throw quizzesError;
  }

  await insertAuditEvent(supabase, profile.id, "ai_course_published", "course", courseId, {});

  revalidateLearningPaths(courseId, lessonIds);
  redirect(appendAdminNotice(redirectTo, "Approved AI course published."));
}

export async function saveLearningMediaAsset(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const assetId = sanitizePlainTextInput(String(formData.get("assetId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);

  const { error } = await supabase
    .from("learning_media_assets")
    .update({
      asset_type: sanitizePlainTextInput(String(formData.get("assetType") ?? "image"), 40),
      placement: sanitizePlainTextInput(String(formData.get("placement") ?? ""), 180),
      prompt: sanitizePlainTextInput(String(formData.get("prompt") ?? ""), 2000),
      script: sanitizePlainTextInput(String(formData.get("script") ?? ""), 4000),
      url: sanitizeUrlInput(String(formData.get("url") ?? ""), 1000) || null,
      alt_text: sanitizePlainTextInput(String(formData.get("altText") ?? ""), 240),
      caption: sanitizePlainTextInput(String(formData.get("caption") ?? ""), 500),
      review_status: sanitizePlainTextInput(String(formData.get("reviewStatus") ?? "draft"), 40),
    })
    .eq("id", assetId);

  if (error) throw error;

  const { course } = await getCourseWorkflowData(supabase, courseId);
  if (course.ai_media_status === "approved") {
    const { error: resetError } = await supabase.rpc("admin_reset_ai_course_media", {
      p_course_id: courseId,
      p_lesson_id: lessonId || null,
      p_media_status: "draft",
    });

    if (resetError) throw resetError;
  }

  await insertAuditEvent(supabase, profile.id, "learning_media_asset_updated", "media_asset", assetId, {
    courseId,
    lessonId: lessonId || null,
  });

  revalidateLearningPaths(courseId, lessonId ? [lessonId] : []);
  redirect(appendAdminNotice(redirectTo, "Media asset saved."));
}
