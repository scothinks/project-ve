"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import {
  parseAiGenerationInputForm,
  type ValidatedAiCourseGenerationInput,
} from "@/lib/admin-ai-validation";
import {
  clampAiGenerationRequest,
  generateAiCourseDraft as generateAiCourseDraftFromModel,
  generateAiLessonExtension,
  getAiLearningConfig,
  type AiCourseExtensionContext,
  type AiCourseGenerationInput,
  type AiGeneratedBlock,
  type AiGeneratedCourseDraft,
  type AiGeneratorLevel,
} from "@/lib/ai-learning-generator";
import {
  generateLearningMediaImage,
  getAiMediaConfig,
  type LearningMediaAssetForGeneration,
  type LearningMediaGenerationContext,
} from "@/lib/ai-media-generator";
import { normalizeImageFit, normalizeImagePosition } from "@/lib/image-presentation";
import {
  isGenerationExcludedMediaAsset,
  isImageMediaAsset,
  isRequiredMediaAsset,
  validateMediaApproval,
  type MediaApprovalValidation,
} from "@/lib/ai-media-workflow";
import { logAppError, ValidationError } from "@/lib/app-errors";
import { formatValidationIssues } from "@/lib/form-data-validation";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";
import type { ValidationResult } from "@/lib/request-validation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Database, Json } from "@/types/database";

type WorkflowCourseRow = {
  id: string;
  slug?: string;
  title: string;
  description: string;
  category: string;
  level: AiGeneratorLevel;
  thumbnail?: Record<string, unknown> | null;
  status: string;
  ai_generated: boolean;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
  ai_generation_notes: Record<string, unknown>;
  text_approved_at?: string | null;
  text_approved_by?: string | null;
  media_approved_at?: string | null;
  media_approved_by?: string | null;
};

type WorkflowLessonRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  cover_image?: Record<string, unknown> | null;
  sort_order: number;
  ai_generated: boolean;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
  ai_generation_notes: Record<string, unknown>;
  media_approved_at?: string | null;
  media_approved_by?: string | null;
};

type WorkflowLessonPageRow = {
  id: string;
  lesson_id: string;
  page_number: number;
  title: string;
  subtitle: string | null;
  page_type: string;
};

type WorkflowQuizRow = {
  id: string;
  lesson_id: string;
  title: string;
  ai_generated: boolean;
  ai_text_status: string;
  status: string;
};

type WorkflowLessonBlockRow = {
  id?: string;
  page_id: string;
  block_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

type WorkflowQuizQuestionRow = {
  quiz_id: string;
  question_order: number;
  prompt: string;
  explanation: string | null;
  xp: number;
};

type WorkflowMediaAssetRow = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  asset_type: string;
  placement: string;
  source: string;
  prompt: string | null;
  script: string | null;
  url: string | null;
  storage_path: string | null;
  provider: string | null;
  model: string | null;
  alt_text: string | null;
  caption: string | null;
  metadata: Record<string, unknown>;
  review_status: string;
  generation_status: string;
  generation_error: string | null;
  sort_order: number;
};

type MediaTarget =
  | { kind: "course_thumbnail" | "course_cover" | "asset_only"; key: string; pageId?: undefined }
  | { kind: "lesson_thumbnail"; key: string; pageId?: undefined }
  | { kind: "page_block"; key: string; pageId: string }
  | { kind: "page_cover"; key: string; pageId: string };

type LearningMediaAssetInsert = Database["public"]["Tables"]["learning_media_assets"]["Insert"];

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function buildCourseCoverPrompt(course: Pick<WorkflowCourseRow, "title" | "description" | "category">) {
  return `Warm, modern educational illustration for the course "${course.title}" in ${course.category}. ${course.description}`;
}

function buildCourseThumbnailPrompt(course: Pick<WorkflowCourseRow, "title" | "description" | "category">) {
  return `Mobile-friendly course thumbnail for "${course.title}" in ${course.category}. ${course.description}`;
}

function buildLessonThumbnailPrompt(
  course: Pick<WorkflowCourseRow, "title" | "category">,
  lesson: Pick<WorkflowLessonRow, "title" | "description">,
) {
  return `Lesson thumbnail for "${lesson.title}" in the course "${course.title}". ${lesson.description ?? `Topic area: ${course.category}.`}`;
}

function buildPageVisualPrompt(
  course: Pick<WorkflowCourseRow, "title" | "category">,
  lesson: Pick<WorkflowLessonRow, "title" | "description">,
  page: Pick<WorkflowLessonPageRow, "title" | "subtitle" | "page_type">,
  assetType: "image" | "infographic",
) {
  if (assetType === "infographic") {
    return `Wide visual infographic for the lesson "${lesson.title}" in the course "${course.title}", focused on the page "${page.title}" (${page.page_type}). Summarize the idea simply with icons, symbols, or scene cues. ${page.subtitle ?? lesson.description ?? `Topic area: ${course.category}.`}`;
  }

  return `Wide in-page illustration for the lesson "${lesson.title}" in the course "${course.title}", focused on the page "${page.title}" (${page.page_type}). ${page.subtitle ?? lesson.description ?? `Topic area: ${course.category}.`}`;
}

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

function requireValidAiForm<T>(result: ValidationResult<T>) {
  if (!result.ok) {
    throw new ValidationError(`Invalid AI course form data. ${formatValidationIssues(result.issues)}`);
  }

  return result.data;
}

function parseAiGenerationInput(formData: FormData): AiCourseGenerationInput {
  const input = requireValidAiForm<ValidatedAiCourseGenerationInput>(
    parseAiGenerationInputForm(formData),
  );

  return clampAiGenerationRequest(input);
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
  mode: "create_course" | "extend_course" | "revise_course" = "create_course",
) {
  const config = getAiLearningConfig();
  return {
    source: "openai",
    jobId,
    mode,
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
    .select("id, slug, title, description, category, level, thumbnail, status, ai_generated, ai_text_status, ai_media_status, ai_publish_status, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) {
    throw new Error("Course not found.");
  }
  const courseRow = course as WorkflowCourseRow;

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, course_id, title, description, cover_image, sort_order, ai_generated, ai_text_status, ai_media_status, ai_publish_status, ai_generation_notes, media_approved_at, media_approved_by")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (lessonsError) throw lessonsError;

  const lessonRows = (lessons ?? []) as WorkflowLessonRow[];
  const lessonIds = lessonRows.map((lesson) => lesson.id);
  let quizzes: WorkflowQuizRow[] = [];
  let pages: WorkflowLessonPageRow[] = [];

  if (lessonIds.length > 0) {
    const [quizResult, pagesResult] = await Promise.all([
      supabase
        .from("quizzes")
        .select("id, lesson_id, title, ai_generated, ai_text_status, status")
        .in("lesson_id", lessonIds),
      supabase
        .from("lesson_pages")
        .select("id, lesson_id, page_number, title, subtitle, page_type")
        .in("lesson_id", lessonIds)
        .order("page_number", { ascending: true }),
    ]);

    if (quizResult.error) throw quizResult.error;
    if (pagesResult.error) throw pagesResult.error;
    quizzes = (quizResult.data ?? []) as WorkflowQuizRow[];
    pages = (pagesResult.data ?? []) as WorkflowLessonPageRow[];
  }

  return { course: courseRow, lessons: lessonRows, quizzes, pages };
}

async function getCourseRevisionData(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
) {
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const lessonIds = workflow.lessons.map((lesson) => lesson.id);
  const quizIds = workflow.quizzes.map((quiz) => quiz.id);
  const pageIds = workflow.pages.map((page) => page.id);

  let blocks: WorkflowLessonBlockRow[] = [];
  let questions: WorkflowQuizQuestionRow[] = [];

  if (pageIds.length > 0) {
    const { data, error } = await supabase
      .from("lesson_content_blocks")
      .select("page_id, block_type, sort_order, payload")
      .in("page_id", pageIds)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    blocks = (data ?? []) as WorkflowLessonBlockRow[];
  }

  if (quizIds.length > 0) {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("quiz_id, question_order, prompt, explanation, xp")
      .in("quiz_id", quizIds)
      .order("question_order", { ascending: true });

    if (error) throw error;
    questions = (data ?? []) as WorkflowQuizQuestionRow[];
  }

  return {
    ...workflow,
    lessonIds,
    quizIds,
    pageIds,
    blocks,
    questions,
  };
}

function ensureAiCourse(course: WorkflowCourseRow) {
  if (!course.ai_generated) {
    throw new Error("This workflow only applies to AI-generated courses.");
  }
}

function ensureAiLesson(lesson: WorkflowLessonRow) {
  if (!lesson.ai_generated) {
    throw new Error("This workflow only applies to AI-generated lessons.");
  }
}

async function getLessonWorkflowData(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  lessonId: string,
) {
  const { data: lessonLookup, error: lessonLookupError } = await supabase
    .from("lessons")
    .select("course_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonLookupError) throw lessonLookupError;
  if (!lessonLookup) {
    throw new Error("Lesson not found.");
  }

  const workflow = await getCourseWorkflowData(supabase, lessonLookup.course_id);
  const lesson = workflow.lessons.find((row) => row.id === lessonId);

  if (!lesson) {
    throw new Error("Lesson not found.");
  }

  const quiz = workflow.quizzes.find((row) => row.lesson_id === lessonId) ?? null;
  const lessonPages = workflow.pages.filter((page) => page.lesson_id === lessonId);

  return {
    ...workflow,
    lesson,
    quiz,
    lessonPages,
  };
}

async function getCourseMediaAssets(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
) {
  const { data, error } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorkflowMediaAssetRow[];
}

function assetHasStartedGenerationOrReview(asset: WorkflowMediaAssetRow) {
  return assetHasUsablePreview(asset)
    || asset.generation_status !== "pending"
    || asset.review_status !== "draft";
}

function deriveCourseTextStatus(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
) {
  const aiLessons = lessons.filter((lesson) => lesson.ai_generated);

  if (aiLessons.length === 0) {
    return course.ai_text_status;
  }

  if (aiLessons.every((lesson) => lesson.ai_text_status === "approved")) {
    return "approved";
  }

  if (aiLessons.some((lesson) => lesson.ai_text_status === "changes_requested")) {
    return "changes_requested";
  }

  if (aiLessons.some((lesson) => lesson.ai_text_status === "approved")) {
    return "in_review";
  }

  return "draft";
}

function deriveCourseMediaStatus(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
  assets: WorkflowMediaAssetRow[],
) {
  const aiLessons = lessons.filter((lesson) => lesson.ai_generated);

  if (aiLessons.length === 0) {
    return course.ai_media_status;
  }

  const lessonStatuses = aiLessons.map((lesson) => lesson.ai_media_status);
  const courseAssets = assets.filter((asset) => asset.lesson_id === null);
  const requiredCourseAssets = courseAssets.filter(isRequiredMediaAsset);
  const courseAssetValidation = validateMediaApproval(courseAssets);
  const courseRequiredAssetsApproved =
    requiredCourseAssets.length > 0
    && courseAssetValidation.missingRequiredAssets.length === 0
    && courseAssetValidation.failedRequiredAssets.length === 0
    && requiredCourseAssets.every((asset) => asset.review_status === "approved");

  if (lessonStatuses.every((status) => status === "approved") && courseRequiredAssetsApproved) {
    return "approved";
  }

  if (
    lessonStatuses.some((status) => status === "changes_requested")
    || courseAssets.some((asset) => asset.review_status === "changes_requested")
  ) {
    return "changes_requested";
  }

  if (
    lessonStatuses.some((status) => status === "draft" || status === "in_review" || status === "approved")
    || courseAssets.some(assetHasStartedGenerationOrReview)
  ) {
    return "in_review";
  }

  if (lessonStatuses.some((status) => status === "generation_ready")) {
    return "generation_ready";
  }

  return "not_started";
}

function aiPublishReady(status: string) {
  return status === "ready" || status === "published";
}

function deriveCoursePublishStatus(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
  courseTextStatus: string,
  courseMediaStatus: string,
) {
  const aiLessons = lessons.filter((lesson) => lesson.ai_generated);
  const allLessonsReady = aiLessons.every((lesson) => aiPublishReady(lesson.ai_publish_status));

  if (courseTextStatus !== "approved" || courseMediaStatus !== "approved" || !allLessonsReady) {
    return "not_ready";
  }

  return course.status === "published" ? "published" : "ready";
}

async function recomputeCourseAiStatuses(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
  actorUserId: string,
) {
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, lessons } = workflow;
  ensureAiCourse(course);

  const assets = await getCourseMediaAssets(supabase, courseId);
  const nextTextStatus = deriveCourseTextStatus(course, lessons);
  const nextMediaStatus = deriveCourseMediaStatus(course, lessons, assets);
  const nextPublishStatus = deriveCoursePublishStatus(course, lessons, nextTextStatus, nextMediaStatus);
  const patch: Record<string, unknown> = {
    ai_text_status: nextTextStatus,
    ai_media_status: nextMediaStatus,
    ai_publish_status: nextPublishStatus,
  };

  if (nextTextStatus === "approved") {
    patch.text_approved_at = course.text_approved_at ?? new Date().toISOString();
    patch.text_approved_by = course.text_approved_by ?? actorUserId;
  } else {
    patch.text_approved_at = null;
    patch.text_approved_by = null;
  }

  if (nextMediaStatus === "approved") {
    patch.media_approved_at = course.media_approved_at ?? new Date().toISOString();
    patch.media_approved_by = course.media_approved_by ?? actorUserId;
  } else {
    patch.media_approved_at = null;
    patch.media_approved_by = null;
  }

  const { error } = await supabase
    .from("courses")
    .update(patch)
    .eq("id", courseId);

  if (error) throw error;

  return {
    course,
    lessons,
    nextTextStatus,
    nextMediaStatus,
    nextPublishStatus,
  };
}

function getGeneratedFromInput(course: Pick<WorkflowCourseRow, "ai_generation_notes" | "level" | "title">) {
  const notes = asRecord(course.ai_generation_notes);
  const generatedFrom = asRecord(notes.generatedFrom);
  return {
    audience: sanitizePlainTextInput(String(generatedFrom.audience ?? "Current course learners"), 160) || "Current course learners",
    region: sanitizePlainTextInput(String(generatedFrom.region ?? "Current course region"), 120) || "Current course region",
    tone: sanitizePlainTextInput(String(generatedFrom.tone ?? "clear and practical"), 120) || "clear and practical",
    difficulty:
      String(generatedFrom.difficulty ?? course.level) === "advanced"
        ? "advanced"
        : String(generatedFrom.difficulty ?? course.level) === "intermediate"
          ? "intermediate"
          : "beginner",
    topic: sanitizePlainTextInput(String(generatedFrom.topic ?? course.title), 160) || course.title,
  } satisfies Pick<AiCourseGenerationInput, "audience" | "region" | "tone" | "difficulty" | "topic">;
}

function getRedirectTarget(formData: FormData, fallback: string) {
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? fallback), 400);
  return redirectTo || fallback;
}

function parseBooleanFlag(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function parseImagePresentationInput(formData: FormData) {
  return {
    fit: normalizeImageFit(String(formData.get("imageFit") ?? "cover")),
    positionX: normalizeImagePosition(Number.parseInt(String(formData.get("imagePositionX") ?? "50"), 10), 50),
    positionY: normalizeImagePosition(Number.parseInt(String(formData.get("imagePositionY") ?? "50"), 10), 50),
  };
}

function getImagePayloadString(image: Record<string, unknown> | null | undefined, key: string) {
  const value = image?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseRequiredChangeRequest(formData: FormData, fieldName: string) {
  const feedback = sanitizePlainTextInput(String(formData.get(fieldName) ?? ""), 3000).trim();
  if (!feedback) {
    throw new Error("Add the specific changes you want before submitting.");
  }
  return feedback;
}

function getLatestTextRevisionFeedback(notes: Record<string, unknown>) {
  const history = Array.isArray(notes.textRevisionFeedbackHistory)
    ? notes.textRevisionFeedbackHistory
    : [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = asRecord(history[index]);
    const kind = sanitizePlainTextInput(String(entry.kind ?? ""), 40);
    const feedback = sanitizePlainTextInput(String(entry.feedback ?? ""), 3000).trim();
    if (kind === "request" && feedback) {
      return {
        feedback,
        requestedAt: sanitizePlainTextInput(String(entry.requestedAt ?? ""), 80),
        requestedBy: sanitizePlainTextInput(String(entry.requestedBy ?? ""), 80),
      };
    }
  }

  return null;
}

function appendTextRevisionFeedback(
  notes: Record<string, unknown>,
  entry: Record<string, unknown>,
) {
  const history = Array.isArray(notes.textRevisionFeedbackHistory)
    ? notes.textRevisionFeedbackHistory.slice(-9)
    : [];

  return {
    ...notes,
    textRevisionFeedbackHistory: [...history, entry],
  };
}

function getLatestMediaRevisionFeedback(notes: Record<string, unknown>) {
  const history = Array.isArray(notes.mediaRevisionFeedbackHistory)
    ? notes.mediaRevisionFeedbackHistory
    : [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = asRecord(history[index]);
    const kind = sanitizePlainTextInput(String(entry.kind ?? ""), 40);
    const feedback = sanitizePlainTextInput(String(entry.feedback ?? ""), 3000).trim();
    if (kind === "request" && feedback) {
      return {
        feedback,
        requestedAt: sanitizePlainTextInput(String(entry.requestedAt ?? ""), 80),
        requestedBy: sanitizePlainTextInput(String(entry.requestedBy ?? ""), 80),
      };
    }
  }

  return null;
}

function appendMediaRevisionFeedback(
  notes: Record<string, unknown>,
  entry: Record<string, unknown>,
) {
  const history = Array.isArray(notes.mediaRevisionFeedbackHistory)
    ? notes.mediaRevisionFeedbackHistory.slice(-9)
    : [];

  return {
    ...notes,
    mediaRevisionFeedbackHistory: [...history, entry],
  };
}

function summarizeBlockForRevision(block: WorkflowLessonBlockRow) {
  const payload = asRecord(block.payload);
  const candidates = [
    payload.heading,
    payload.title,
    payload.body,
    payload.caption,
    payload.transcript,
    payload.alt,
  ];

  return candidates
    .map((value) => sanitizePlainTextInput(String(value ?? ""), 180).trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
}

function getRecommendedQuestionCountForRevision(level: AiGeneratorLevel) {
  if (level === "advanced") return 9;
  if (level === "intermediate") return 8;
  return 7;
}

function buildCourseRevisionNotes({
  course,
  lessons,
  pages,
  blocks,
  quizzes,
  questions,
  feedback,
}: {
  course: WorkflowCourseRow;
  lessons: WorkflowLessonRow[];
  pages: WorkflowLessonPageRow[];
  blocks: WorkflowLessonBlockRow[];
  quizzes: WorkflowQuizRow[];
  questions: WorkflowQuizQuestionRow[];
  feedback: string;
}) {
  const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>();
  for (const page of pages) {
    const current = pagesByLessonId.get(page.lesson_id) ?? [];
    current.push(page);
    pagesByLessonId.set(page.lesson_id, current);
  }

  const blocksByPageId = new Map<string, WorkflowLessonBlockRow[]>();
  for (const block of blocks) {
    const current = blocksByPageId.get(block.page_id) ?? [];
    current.push(block);
    blocksByPageId.set(block.page_id, current);
  }

  const quizByLessonId = new Map<string, WorkflowQuizRow>();
  for (const quiz of quizzes) {
    quizByLessonId.set(quiz.lesson_id, quiz);
  }

  const questionsByQuizId = new Map<string, WorkflowQuizQuestionRow[]>();
  for (const question of questions) {
    const current = questionsByQuizId.get(question.quiz_id) ?? [];
    current.push(question);
    questionsByQuizId.set(question.quiz_id, current);
  }

  const lessonSummaries = lessons.map((lesson, lessonIndex) => {
    const lessonPages = pagesByLessonId.get(lesson.id) ?? [];
    const quiz = quizByLessonId.get(lesson.id);
    const quizQuestions = quiz ? questionsByQuizId.get(quiz.id) ?? [] : [];
    const pageLines = lessonPages.map((page) => {
      const blockSummary = (blocksByPageId.get(page.id) ?? [])
        .slice(0, 3)
        .map(summarizeBlockForRevision)
        .filter(Boolean)
        .join(" ");
      return `- Page ${page.page_number}: ${page.title} (${page.page_type}) ${page.subtitle ?? ""} ${blockSummary}`.trim();
    });
    const quizLines = quizQuestions
      .slice(0, 7)
      .map((question) => `- Q${question.question_order}: ${question.prompt} [xp ${question.xp}]`);

    return [
      `${lessonIndex + 1}. ${lesson.title}`,
      `Lesson description: ${lesson.description ?? "No description."}`,
      "Pages:",
      ...pageLines,
      `Quiz title: ${quiz?.title ?? "No quiz."}`,
      ...quizLines,
    ].join("\n");
  });

  return [
    `Current course title: ${course.title}`,
    `Current course description: ${course.description}`,
    `Current course category: ${course.category}`,
    `Current course level: ${course.level}`,
    `Editor requested changes: ${feedback}`,
    "Revise the existing course draft instead of creating a different course.",
    "Address the requested changes directly and improve the weak areas named by the editor.",
    "Keep the course coherent, practical, safe, and suitable for semi-literate to secondary-school learners.",
    "Keep or improve the overall course structure while making the revisions meaningful.",
    "Current lesson/page/quiz structure:",
    ...lessonSummaries,
  ].join("\n\n");
}

function buildAssetKey(asset: Pick<WorkflowMediaAssetRow, "course_id" | "lesson_id" | "asset_type" | "placement">) {
  return `${asset.course_id ?? "course"}:${asset.lesson_id ?? "none"}:${asset.asset_type}:${asset.placement}`;
}

function parsePageNumberFromPlacement(placement: string) {
  const match = placement.toLowerCase().match(/page[_ -]?(\d+)/i);
  if (!match) {
    return null;
  }

  const pageNumber = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(pageNumber) ? pageNumber : null;
}

function getAssetTargetPageId(
  asset: Pick<WorkflowMediaAssetRow, "metadata" | "placement">,
  pages: WorkflowLessonPageRow[],
) {
  const metadata = asRecord(asset.metadata);
  const targetPageId = getMetadataString(metadata, "targetPageId");
  if (targetPageId) {
    return targetPageId;
  }

  const pageNumber = parsePageNumberFromPlacement(asset.placement);
  if (pageNumber === null) {
    return null;
  }

  return pages.find((page) => page.page_number === pageNumber)?.id ?? null;
}

function hasPageLevelVisualAsset(
  assets: WorkflowMediaAssetRow[],
  pages: WorkflowLessonPageRow[],
  pageId: string,
) {
  return assets.some((asset) => (
    (asset.asset_type === "image" || asset.asset_type === "infographic")
    && getAssetTargetPageId(asset, pages) === pageId
  ));
}

function selectImageSeedPage(pages: WorkflowLessonPageRow[]) {
  return pages.find((page) => page.page_type === "concept")
    ?? pages.find((page) => page.page_type === "example")
    ?? pages[0]
    ?? null;
}

function selectInfographicSeedPage(pages: WorkflowLessonPageRow[], excludedPageId: string | null) {
  return pages.find((page) => page.page_type === "summary" && page.id !== excludedPageId)
    ?? pages.find((page) => page.page_type === "reflection" && page.id !== excludedPageId)
    ?? pages.find((page) => page.id !== excludedPageId)
    ?? null;
}

function createPageVisualSeedRows(
  course: WorkflowCourseRow,
  lesson: WorkflowLessonRow,
  pages: WorkflowLessonPageRow[],
  existingAssets: WorkflowMediaAssetRow[],
  jobId: string,
  pushRow: (row: Record<string, unknown>) => void,
) {
  const imagePage = selectImageSeedPage(pages);
  const infographicPage = selectInfographicSeedPage(pages, imagePage?.id ?? null);

  if (imagePage && !hasPageLevelVisualAsset(existingAssets, pages, imagePage.id)) {
    pushRow({
      course_id: course.id,
      lesson_id: lesson.id,
      asset_type: "image",
      placement: `page_${imagePage.page_number}_image`,
      source: "ai_generated",
      prompt: buildPageVisualPrompt(course, lesson, imagePage, "image"),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${imagePage.title} illustration`,
      caption: imagePage.title,
      metadata: {
        jobId,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        required: false,
        targetKind: "page_cover",
        targetPageId: imagePage.id,
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: 0,
    });
  }

  if (infographicPage && !hasPageLevelVisualAsset(existingAssets, pages, infographicPage.id)) {
    pushRow({
      course_id: course.id,
      lesson_id: lesson.id,
      asset_type: "infographic",
      placement: `page_${infographicPage.page_number}_infographic`,
      source: "ai_generated",
      prompt: buildPageVisualPrompt(course, lesson, infographicPage, "infographic"),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${infographicPage.title} visual summary`,
      caption: infographicPage.title,
      metadata: {
        jobId,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        required: false,
        targetKind: "page_block",
        preferredPlacement: "page_block",
        mediaNote: "Infographics are intended for in-page teaching use, not page cover art.",
        targetPageId: infographicPage.id,
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: 0,
    });
  }
}

function getAssetPresentation(asset: Pick<WorkflowMediaAssetRow, "metadata">) {
  const metadata = asRecord(asset.metadata);
  return {
    fit: normalizeImageFit(String(metadata.fit ?? "cover")),
    positionX: normalizeImagePosition(metadata.positionX, 50),
    positionY: normalizeImagePosition(metadata.positionY, 50),
  };
}

function buildImagePayloadFromAsset(asset: WorkflowMediaAssetRow) {
  const presentation = getAssetPresentation(asset);
  return {
    src: asset.url,
    alt: asset.alt_text || asset.caption || asset.placement,
    fit: presentation.fit,
    positionX: presentation.positionX,
    positionY: presentation.positionY,
  };
}

function createCourseMediaSeedRows(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
  pages: WorkflowLessonPageRow[],
  existingAssets: WorkflowMediaAssetRow[],
  jobId: string,
) {
  const existingKeys = new Set(existingAssets.map(buildAssetKey));
  const rows: Array<Record<string, unknown>> = [];
  let sortOrderCursor = existingAssets.reduce((max, asset) => Math.max(max, asset.sort_order), -1) + 1;
  const aiLessons = lessons.filter((lesson) => lesson.ai_generated);
  const shouldSeedCourseLevelAssets =
    lessons.length > 0
    && lessons.every((lesson) => lesson.ai_generated)
    || existingAssets.some((asset) => asset.lesson_id === null);

  const pushRow = (row: Record<string, unknown>) => {
    const key = buildAssetKey(row as Pick<WorkflowMediaAssetRow, "course_id" | "lesson_id" | "asset_type" | "placement">);
    if (existingKeys.has(key)) {
      return;
    }

    existingKeys.add(key);
    rows.push({
      ...row,
      sort_order: sortOrderCursor,
    });
    sortOrderCursor += 1;
  };

  if (shouldSeedCourseLevelAssets) {
    pushRow({
      course_id: course.id,
      lesson_id: null,
      asset_type: "cover",
      placement: "course_cover",
      source: "ai_generated",
      prompt: buildCourseCoverPrompt(course),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${course.title} course cover illustration`,
      caption: course.title,
      metadata: {
        jobId,
        required: false,
        targetKind: "course_cover",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: sortOrderCursor,
    });

    pushRow({
      course_id: course.id,
      lesson_id: null,
      asset_type: "thumbnail",
      placement: "course_thumbnail",
      source: "ai_generated",
      prompt: buildCourseThumbnailPrompt(course),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${course.title} course thumbnail`,
      caption: course.title,
      metadata: {
        jobId,
        required: true,
        targetKind: "course_thumbnail",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: sortOrderCursor,
    });
  }

  const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>();
  for (const page of pages) {
    const current = pagesByLessonId.get(page.lesson_id) ?? [];
    current.push(page);
    pagesByLessonId.set(page.lesson_id, current);
  }

  for (const lesson of aiLessons) {
    const lessonPages = pagesByLessonId.get(lesson.id) ?? [];

    pushRow({
      course_id: course.id,
      lesson_id: lesson.id,
      asset_type: "thumbnail",
      placement: "lesson_thumbnail",
      source: "ai_generated",
      prompt: buildLessonThumbnailPrompt(course, lesson),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${lesson.title} lesson thumbnail`,
      caption: lesson.title,
      metadata: {
        jobId,
        required: true,
        targetKind: "lesson_thumbnail",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
    });

    createPageVisualSeedRows(
      course,
      lesson,
      lessonPages,
      existingAssets.filter((asset) => asset.lesson_id === lesson.id),
      jobId,
      pushRow,
    );
  }

  return rows;
}

function createLessonMediaSeedRows(
  course: WorkflowCourseRow,
  lesson: WorkflowLessonRow,
  pages: WorkflowLessonPageRow[],
  existingAssets: WorkflowMediaAssetRow[],
  jobId: string,
) {
  const existingKeys = new Set(existingAssets.map(buildAssetKey));
  const rows: Array<Record<string, unknown>> = [];
  let sortOrderCursor = existingAssets.reduce((max, asset) => Math.max(max, asset.sort_order), -1) + 1;

  const pushRow = (row: Record<string, unknown>) => {
    const key = buildAssetKey(row as Pick<WorkflowMediaAssetRow, "course_id" | "lesson_id" | "asset_type" | "placement">);
    if (existingKeys.has(key)) {
      return;
    }

    existingKeys.add(key);
    rows.push({
      ...row,
      sort_order: sortOrderCursor,
    });
    sortOrderCursor += 1;
  };

  pushRow({
    course_id: course.id,
    lesson_id: lesson.id,
    asset_type: "thumbnail",
    placement: "lesson_thumbnail",
    source: "ai_generated",
    prompt: buildLessonThumbnailPrompt(course, lesson),
    script: "",
    url: null,
    storage_path: null,
    provider: null,
    model: null,
    alt_text: `${lesson.title} lesson thumbnail`,
    caption: lesson.title,
    metadata: {
      jobId,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      required: true,
      targetKind: "lesson_thumbnail",
    },
    review_status: "draft",
    generation_status: "pending",
    generation_error: null,
  });

  createPageVisualSeedRows(
    course,
    lesson,
    pages,
    existingAssets,
    jobId,
    pushRow,
  );

  return rows;
}

function findPageMatchForPlacement(
  placement: string,
  pages: WorkflowLessonPageRow[],
  usedPageIds: Set<string>,
) {
  const normalizedPlacement = placement.toLowerCase();
  const explicitPageNumber = normalizedPlacement.match(/page[_ -]?(\d+)/i);
  if (explicitPageNumber) {
    const pageNumber = Number.parseInt(explicitPageNumber[1] ?? "", 10);
    const matched = pages.find((page) => page.page_number === pageNumber);
    if (matched) {
      return matched;
    }
  }

  const preferredType =
    normalizedPlacement.includes("summary") ? "summary"
      : normalizedPlacement.includes("reflection") ? "reflection"
        : normalizedPlacement.includes("example") || normalizedPlacement.includes("scenario") ? "example"
          : normalizedPlacement.includes("concept") ? "concept"
            : normalizedPlacement.includes("intro") || normalizedPlacement.includes("primer") ? "concept"
              : "";

  if (preferredType) {
    const matched = pages.find((page) => page.page_type === preferredType && !usedPageIds.has(page.id))
      ?? pages.find((page) => page.page_type === preferredType);
    if (matched) {
      return matched;
    }
  }

  return pages.find((page) => !usedPageIds.has(page.id)) ?? pages[0] ?? null;
}

function resolveMediaTarget(
  asset: WorkflowMediaAssetRow,
  pagesByLessonId: Map<string, WorkflowLessonPageRow[]>,
  usedPageIds: Set<string>,
): MediaTarget | null {
  const metadata = asRecord(asset.metadata);
  const metadataTargetKind = getMetadataString(metadata, "targetKind");
  const metadataTargetPageId = getMetadataString(metadata, "targetPageId");

  if (metadataTargetKind === "course_cover") {
    return { kind: "course_cover", key: `course-cover:${asset.course_id ?? "course"}` };
  }

  if (metadataTargetKind === "course_thumbnail") {
    return { kind: "course_thumbnail", key: `course-thumbnail:${asset.course_id ?? "course"}` };
  }

  if (metadataTargetKind === "lesson_thumbnail") {
    return { kind: "lesson_thumbnail", key: `lesson-thumbnail:${asset.lesson_id ?? "lesson"}` };
  }

  if (
    metadataTargetKind === "asset_only"
    && asset.asset_type === "infographic"
    && metadataTargetPageId
    && getMetadataString(metadata, "preferredPlacement") === "page_block"
  ) {
    return { kind: "page_block", key: `page-block:${metadataTargetPageId}:${asset.id}`, pageId: metadataTargetPageId };
  }

  if (metadataTargetKind === "asset_only") {
    return { kind: "asset_only", key: `asset-only:${asset.id}` };
  }

  if (metadataTargetKind === "page_block" && metadataTargetPageId) {
    return { kind: "page_block", key: `page-block:${metadataTargetPageId}:${asset.id}`, pageId: metadataTargetPageId };
  }

  if (asset.asset_type === "infographic") {
    return { kind: "asset_only", key: `asset-only:${asset.id}` };
  }

  if (metadataTargetKind === "page_cover" && metadataTargetPageId) {
    return { kind: "page_cover", key: `page-cover:${metadataTargetPageId}`, pageId: metadataTargetPageId };
  }

  if (!asset.lesson_id) {
    if (asset.asset_type === "thumbnail") {
      return { kind: "course_thumbnail", key: `course-thumbnail:${asset.course_id ?? "course"}` };
    }

    if (asset.asset_type === "cover") {
      return { kind: "course_cover", key: `course-cover:${asset.course_id ?? "course"}` };
    }

    return { kind: "asset_only", key: `asset-only:${asset.id}` };
  }

  if (asset.asset_type === "thumbnail") {
    return { kind: "lesson_thumbnail", key: `lesson-thumbnail:${asset.lesson_id}` };
  }

  if (asset.asset_type === "cover" && asset.placement.toLowerCase().includes("lesson")) {
    return { kind: "lesson_thumbnail", key: `lesson-thumbnail:${asset.lesson_id}` };
  }

  const pages = pagesByLessonId.get(asset.lesson_id) ?? [];
  const matchedPage = findPageMatchForPlacement(asset.placement, pages, usedPageIds);
  if (!matchedPage) {
    return null;
  }

  return { kind: "page_cover", key: `page-cover:${matchedPage.id}`, pageId: matchedPage.id };
}

async function updateAssetForSkip(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  assetId: string,
  status: "pending" | "skipped" | "failed",
  errorMessage: string | null,
) {
  const { error } = await supabase
    .from("learning_media_assets")
    .update({
      generation_status: status,
      generation_error: errorMessage,
    })
    .eq("id", assetId);

  if (error) {
    throw error;
  }
}

async function applyAssetTarget(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  asset: WorkflowMediaAssetRow,
  target: MediaTarget,
) {
  if (!asset.url) {
    return;
  }

  if (target.kind === "asset_only" || target.kind === "course_cover") {
    return;
  }

  const imagePayload = buildImagePayloadFromAsset(asset);

  if (target.kind === "course_thumbnail" && asset.course_id) {
    const { error } = await supabase
      .from("courses")
      .update({ thumbnail: imagePayload })
      .eq("id", asset.course_id);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "lesson_thumbnail" && asset.lesson_id) {
    const { error } = await supabase
      .from("lessons")
      .update({ cover_image: imagePayload })
      .eq("id", asset.lesson_id);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "page_cover") {
    const { error } = await supabase
      .from("lesson_pages")
      .update({ cover_image: imagePayload })
      .eq("id", target.pageId);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "page_block") {
    const { data: blocks, error: blocksError } = await supabase
      .from("lesson_content_blocks")
      .select("id, page_id, block_type, sort_order, payload")
      .eq("page_id", target.pageId)
      .order("sort_order", { ascending: true });

    if (blocksError) {
      throw blocksError;
    }

    const typedBlocks = (blocks ?? []) as WorkflowLessonBlockRow[];
    const matchingBlock = typedBlocks.find((block) =>
      block.block_type === "image" && asRecord(block.payload).aiManagedByAssetId === asset.id,
    );

    const nextPayload = {
      ...asRecord(matchingBlock?.payload),
      src: asset.url,
      alt: asset.alt_text || asset.caption || asset.placement,
      caption: asset.caption || "",
      aiManagedByAssetId: asset.id,
      aiManagedKind: "learning_media_asset",
      aiGenerated: true,
    };

    if (matchingBlock?.id) {
      const { error } = await supabase
        .from("lesson_content_blocks")
        .update({
          payload: nextPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchingBlock.id);

      if (error) {
        throw error;
      }

      return;
    }

    const nextSortOrder = typedBlocks.reduce((max, block) => Math.max(max, block.sort_order), 0) + 1;
    const { error } = await supabase
      .from("lesson_content_blocks")
      .insert({
        page_id: target.pageId,
        block_type: "image",
        sort_order: nextSortOrder,
        payload: nextPayload,
      });

    if (error) {
      throw error;
    }
  }
}

async function clearAssetTarget(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  asset: WorkflowMediaAssetRow,
  target: MediaTarget,
) {
  if (target.kind === "asset_only" || target.kind === "course_cover") {
    return;
  }

  if (target.kind === "course_thumbnail" && asset.course_id) {
    const { error } = await supabase
      .from("courses")
      .update({ thumbnail: {} })
      .eq("id", asset.course_id);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "lesson_thumbnail" && asset.lesson_id) {
    const { error } = await supabase
      .from("lessons")
      .update({ cover_image: {} })
      .eq("id", asset.lesson_id);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "page_cover") {
    const { error } = await supabase
      .from("lesson_pages")
      .update({ cover_image: {} })
      .eq("id", target.pageId);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "page_block") {
    const { data: blocks, error: blocksError } = await supabase
      .from("lesson_content_blocks")
      .select("id, payload")
      .eq("page_id", target.pageId)
      .eq("block_type", "image");

    if (blocksError) {
      throw blocksError;
    }

    const matchingBlockIds = ((blocks ?? []) as Array<{ id: string; payload: Record<string, unknown> }>)
      .filter((block) => asRecord(block.payload).aiManagedByAssetId === asset.id)
      .map((block) => block.id);

    if (matchingBlockIds.length === 0) {
      return;
    }

    const { error } = await supabase
      .from("lesson_content_blocks")
      .delete()
      .in("id", matchingBlockIds);

    if (error) {
      throw error;
    }
  }
}

const MEDIA_GENERATION_CONCURRENCY = 2;

type MediaGenerationWorkItem = {
  asset: WorkflowMediaAssetRow;
  context: LearningMediaGenerationContext;
  target: MediaTarget;
};

type MediaGenerationCounts = {
  failedCount: number;
  generatedCount: number;
  reusedCount: number;
  skippedCount: number;
};

type MediaGenerationOutcome = keyof Omit<MediaGenerationCounts, "skippedCount">;

async function runWithBoundedConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(limit, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        results.push(await worker(item));
      }
    }),
  );

  return results;
}

function summarizeMediaOutcomes(
  outcomes: MediaGenerationOutcome[],
  skippedCount: number,
): MediaGenerationCounts {
  return outcomes.reduce<MediaGenerationCounts>(
    (counts, outcome) => ({
      ...counts,
      [outcome]: counts[outcome] + 1,
    }),
    {
      failedCount: 0,
      generatedCount: 0,
      reusedCount: 0,
      skippedCount,
    },
  );
}

async function processMediaGenerationWorkItem(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  item: MediaGenerationWorkItem,
  replaceExisting: boolean,
): Promise<MediaGenerationOutcome> {
  const { asset, context, target } = item;

  try {
    const result = await generateLearningMediaImage({
      asset: asset as LearningMediaAssetForGeneration,
      context,
      replaceExisting,
    });

    const updatedAsset: WorkflowMediaAssetRow = {
      ...asset,
      url: result.url,
      storage_path: result.storagePath,
      provider: result.provider,
      model: result.model,
      generation_status: "completed",
      generation_error: null,
      metadata: {
        ...asRecord(asset.metadata),
        generatedAt: result.generatedAt,
        revisedPrompt: result.revisedPrompt,
        targetKind: target.kind,
        targetPageId: target.kind === "page_cover" ? target.pageId : null,
      },
    };

    if (result.status === "skipped") {
      const { error } = await supabase
        .from("learning_media_assets")
        .update({
          generation_status: "completed",
          generation_error: null,
          metadata: updatedAsset.metadata as Json,
        })
        .eq("id", asset.id);

      if (error) {
        throw error;
      }
    }

    await applyAssetTarget(supabase, updatedAsset, target);
    return result.status === "generated" ? "generatedCount" : "reusedCount";
  } catch (error) {
    await updateAssetForSkip(
      supabase,
      asset.id,
      "failed",
      error instanceof Error ? error.message : "Image generation failed.",
    ).catch(() => undefined);
    return "failedCount";
  }
}

async function processMediaGenerationWorkItems(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  workItems: MediaGenerationWorkItem[],
  replaceExisting: boolean,
  skippedCount: number,
) {
  const outcomes = await runWithBoundedConcurrency(
    workItems,
    MEDIA_GENERATION_CONCURRENCY,
    (item) => processMediaGenerationWorkItem(supabase, item, replaceExisting),
  );

  return summarizeMediaOutcomes(outcomes, skippedCount);
}

function getContinuityInstruction(formData: FormData) {
  return sanitizePlainTextInput(String(formData.get("continuityInstruction") ?? ""), 1000);
}

function assetHasUsablePreview(asset: WorkflowMediaAssetRow) {
  return typeof asset.url === "string" && asset.url.trim().length > 0;
}

function assetEligibleForApproval(asset: WorkflowMediaAssetRow) {
  return assetHasUsablePreview(asset)
    && asset.generation_status !== "failed"
    && asset.generation_status !== "skipped";
}

function getApprovedReviewStatus(asset: WorkflowMediaAssetRow) {
  if (!assetEligibleForApproval(asset)) {
    return asset.review_status;
  }

  if (isRequiredMediaAsset(asset)) {
    return "approved";
  }

  if (asset.review_status === "draft" || asset.review_status === "in_review") {
    return "approved";
  }

  return asset.review_status;
}

function buildCourseExtensionContext(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
  continuityInstruction: string,
): AiCourseExtensionContext {
  return {
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
    },
    lessons: lessons.map((lesson) => ({
      title: lesson.title,
      description: lesson.description ?? "",
    })),
    continuityInstruction: continuityInstruction || undefined,
  };
}

function ensureNoDuplicateLessonTitles(
  existingLessons: WorkflowLessonRow[],
  generatedLessons: AiGeneratedCourseDraft["lessons"],
) {
  const existingSlugs = new Set(existingLessons.map((lesson) => slugify(lesson.title)));
  const newSlugs = new Set<string>();

  for (const lesson of generatedLessons) {
    const normalizedTitle = slugify(lesson.title);
    if (!normalizedTitle) {
      throw new Error("A generated lesson is missing a valid title.");
    }

    if (existingSlugs.has(normalizedTitle)) {
      throw new Error(`The AI tried to create a duplicate lesson title: "${lesson.title}". Adjust the prompt and try again.`);
    }

    if (newSlugs.has(normalizedTitle)) {
      throw new Error(`The AI returned duplicate new lesson titles, including "${lesson.title}". Try again with clearer sequencing guidance.`);
    }

    newSlugs.add(normalizedTitle);
  }
}

function buildGeneratedLessonTreeRows({
  courseId,
  lessons,
  jobId,
  startingSortOrder,
}: {
  courseId: string;
  lessons: AiGeneratedCourseDraft["lessons"];
  jobId: string | null;
  startingSortOrder: number;
}) {
  const lessonRows: Array<Record<string, unknown>> = [];
  const pageRows: Array<Record<string, unknown>> = [];
  const blockRows: Array<Record<string, unknown>> = [];
  const quizRows: Array<Record<string, unknown>> = [];
  const questionRows: Array<Record<string, unknown>> = [];
  const optionRows: Array<Record<string, unknown>> = [];
  const mediaRows: Array<Record<string, unknown>> = [];
  const lessonIds: string[] = [];

  for (const [lessonIndex, lesson] of lessons.entries()) {
    const lessonId = createTextId("lesson", lesson.title);
    const quizId = `quiz-${lessonId.replace(/^lesson-/, "")}`;
    const generatedPages: Array<{ id: string; page_number: number; page_type: string }> = [];
    lessonIds.push(lessonId);
    lessonRows.push({
      id: lessonId,
      course_id: courseId,
      slug: `${slugify(lesson.title)}-${startingSortOrder + lessonIndex}`,
      title: lesson.title,
      description: lesson.description,
      cover_image: {},
      status: "draft",
      sort_order: startingSortOrder + lessonIndex,
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
        lessonIndex: startingSortOrder + lessonIndex,
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
      const pageType = mapAiPageTypeToDb(page.pageType);
      generatedPages.push({
        id: pageId,
        page_number: pageIndex + 1,
        page_type: pageType,
      });
      pageRows.push({
        id: pageId,
        lesson_id: lessonId,
        page_number: pageIndex + 1,
        title: page.title,
        subtitle: page.subtitle,
        page_type: pageType,
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

    const resolveGeneratedPageIdForPlacement = (placement: string) => {
      const explicitPageNumber = parsePageNumberFromPlacement(placement);
      if (explicitPageNumber !== null) {
        return generatedPages.find((page) => page.page_number === explicitPageNumber)?.id ?? null;
      }

      const normalizedPlacement = placement.toLowerCase();
      const preferredType =
        normalizedPlacement.includes("summary") ? "summary"
          : normalizedPlacement.includes("reflection") ? "reflection"
            : normalizedPlacement.includes("example") || normalizedPlacement.includes("scenario") ? "example"
              : normalizedPlacement.includes("concept") || normalizedPlacement.includes("intro") || normalizedPlacement.includes("primer") ? "concept"
                : "";

      if (!preferredType) {
        return null;
      }

      return generatedPages.find((page) => page.page_type === preferredType)?.id ?? null;
    };

    for (const [mediaIndex, mediaBrief] of lesson.mediaBriefs.entries()) {
      const targetPageId = mediaBrief.assetType === "image" || mediaBrief.assetType === "infographic"
        ? resolveGeneratedPageIdForPlacement(mediaBrief.placement)
        : null;

      mediaRows.push({
        course_id: courseId,
        lesson_id: lessonId,
        asset_type: mediaBrief.assetType,
        placement: mediaBrief.placement,
        source: "ai_generated",
        prompt: mediaBrief.prompt,
        script: mediaBrief.script,
        url: null,
        storage_path: null,
        provider: null,
        model: null,
        alt_text: mediaBrief.altText,
        caption: mediaBrief.caption,
        metadata: {
          jobId,
          lessonId,
          lessonTitle: lesson.title,
          targetKind:
            mediaBrief.assetType === "thumbnail" ? "lesson_thumbnail"
              : mediaBrief.assetType === "image" ? "page_cover"
                : mediaBrief.assetType === "infographic" ? "page_block"
                : undefined,
          preferredPlacement:
            mediaBrief.assetType === "infographic" ? "page_block" : undefined,
          mediaNote:
            mediaBrief.assetType === "infographic"
              ? "Infographics are intended for in-page teaching use, not page cover art."
              : undefined,
          targetPageId,
        },
        review_status: "draft",
        generation_status: "pending",
        generation_error: null,
        sort_order: mediaIndex,
      });
    }
  }

  return {
    lessonRows,
    pageRows,
    blockRows,
    quizRows,
    questionRows,
    optionRows,
    mediaRows,
    lessonIds,
  };
}

async function createJob(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  actorUserId: string,
  jobType: "course_text" | "media_assets",
  prompt: Record<string, unknown>,
  options: {
    entityId?: string | null;
    status?: "queued" | "running";
  } = {},
) {
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .insert({
      entity_type: "course",
      entity_id: options.entityId ?? null,
      job_type: jobType,
      status: options.status ?? "running",
      prompt,
      result: {},
      created_by: actorUserId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

async function updateJob(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase.from("ai_generation_jobs").update(patch).eq("id", jobId);
  if (error) throw error;
}

type AiGenerationClaim = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  job_type: string;
  prompt: Record<string, unknown>;
  attempt_count: number;
};

type AdminRpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type AdminRpcClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<AdminRpcResult<unknown>>;
};

function getPromptString(prompt: Record<string, unknown>, key: string) {
  const value = prompt[key];
  return typeof value === "string" ? value : "";
}

function getPromptNumber(prompt: Record<string, unknown>, key: string, fallback: number) {
  const value = prompt[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getPromptBoolean(prompt: Record<string, unknown>, key: string) {
  return prompt[key] === true;
}

function isValidationFailure(error: unknown) {
  if (error instanceof ValidationError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; name?: unknown };
  return record.code === "VALIDATION_ERROR" || record.name === "ValidationError";
}

type MediaJobMode = "course_media" | "lesson_media" | "single_media_asset";

function getMediaJobMode(prompt: Record<string, unknown>): MediaJobMode | "" {
  const mode = getPromptString(prompt, "mode");
  if (mode === "course_media" || mode === "lesson_media" || mode === "single_media_asset") {
    return mode;
  }

  if (getPromptString(prompt, "assetId")) {
    return "single_media_asset";
  }

  if (getPromptString(prompt, "lessonId")) {
    return "lesson_media";
  }

  if (getPromptString(prompt, "courseId")) {
    return "course_media";
  }

  return "";
}

function getPromptInput(prompt: Record<string, unknown>): AiCourseGenerationInput {
  return clampAiGenerationRequest({
    audience: getPromptString(prompt, "audience"),
    difficulty:
      getPromptString(prompt, "difficulty") === "advanced"
        ? "advanced"
        : getPromptString(prompt, "difficulty") === "intermediate"
          ? "intermediate"
          : "beginner",
    lessonCount: getPromptNumber(prompt, "lessonCount", 4),
    notes: getPromptString(prompt, "notes"),
    questionsPerLesson: getPromptNumber(prompt, "questionsPerLesson", 7),
    region: getPromptString(prompt, "region"),
    tone: getPromptString(prompt, "tone"),
    topic: getPromptString(prompt, "topic"),
  });
}

async function callAdminRpc<T>(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  functionName: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await (supabase as unknown as AdminRpcClient).rpc(functionName, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function getJobActorUserId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .select("created_by")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const createdBy = (data as { created_by?: string | null } | null)?.created_by;
  return typeof createdBy === "string" ? createdBy : "";
}

async function enqueueCourseTextJob(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  actorUserId: string,
  prompt: Record<string, unknown>,
  entityId?: string | null,
) {
  return createJob(supabase, actorUserId, "course_text", prompt, {
    entityId,
    status: "queued",
  });
}

async function enqueueMediaAssetsJob(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  actorUserId: string,
  prompt: Record<string, unknown>,
  entityId: string,
) {
  return createJob(supabase, actorUserId, "media_assets", prompt, {
    entityId,
    status: "queued",
  });
}

async function claimNextAiGenerationJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  workerId: string,
) {
  const claimed = await callAdminRpc<AiGenerationClaim[]>(supabase, "claim_ai_generation_job", {
    p_worker_id: workerId,
    p_lease_seconds: 1800,
    p_max_attempts: 3,
  });

  return claimed[0] ?? null;
}

async function markAiGenerationJobFailed(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
  error: unknown,
  retry: boolean,
) {
  await callAdminRpc<void>(supabase, "fail_ai_generation_job", {
    p_job_id: jobId,
    p_error: error instanceof Error ? error.message : "AI generation job failed.",
    p_failure_code: isValidationFailure(error) ? "validation_error" : "worker_error",
    p_failure_detail: {
      name: error instanceof Error ? error.name : "UnknownError",
    },
    p_retry: retry,
  });
}

async function materializeAiCourseTextJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  args: {
    courseRow: Record<string, unknown> | null;
    courseUpdate: Record<string, unknown> | null;
    entityId: string;
    generatedTree: ReturnType<typeof buildGeneratedLessonTreeRows>;
    jobId: string;
    jobResult: Record<string, unknown>;
  },
) {
  await callAdminRpc<void>(supabase, "materialize_ai_course_text_job", {
    p_job_id: args.jobId,
    p_entity_id: args.entityId,
    p_course_row: args.courseRow,
    p_course_update: args.courseUpdate,
    p_lesson_rows: args.generatedTree.lessonRows,
    p_page_rows: args.generatedTree.pageRows,
    p_block_rows: args.generatedTree.blockRows,
    p_quiz_rows: args.generatedTree.quizRows,
    p_question_rows: args.generatedTree.questionRows,
    p_option_rows: args.generatedTree.optionRows,
    p_media_rows: args.generatedTree.mediaRows,
    p_job_result: args.jobResult,
  });
}

async function replaceAiCourseTextJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  args: {
    courseUpdate: Record<string, unknown>;
    entityId: string;
    generatedTree: ReturnType<typeof buildGeneratedLessonTreeRows>;
    jobId: string;
    jobResult: Record<string, unknown>;
  },
) {
  await callAdminRpc<void>(supabase, "replace_ai_course_text_job", {
    p_job_id: args.jobId,
    p_entity_id: args.entityId,
    p_course_update: args.courseUpdate,
    p_lesson_rows: args.generatedTree.lessonRows,
    p_page_rows: args.generatedTree.pageRows,
    p_block_rows: args.generatedTree.blockRows,
    p_quiz_rows: args.generatedTree.quizRows,
    p_question_rows: args.generatedTree.questionRows,
    p_option_rows: args.generatedTree.optionRows,
    p_media_rows: args.generatedTree.mediaRows,
    p_job_result: args.jobResult,
  });
}

async function processCreateCourseTextJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: AiGenerationClaim,
) {
  const input = getPromptInput(job.prompt);
  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new ValidationError("AI course generation job is missing required prompt fields.");
  }

  const draft = await generateAiCourseDraftFromModel(input);
  const courseSlugBase = slugify(draft.course.title);
  const courseSlug = `${courseSlugBase}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
  const courseId = createTextId("course", courseSlug);
  const generatedTree = buildGeneratedLessonTreeRows({
    courseId,
    lessons: draft.lessons,
    jobId: job.id,
    startingSortOrder: 1,
  });

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
    ai_generation_notes: buildCourseNotes(input, job.id, draft, "create_course"),
  };

  generatedTree.mediaRows.push(
    {
      course_id: courseId,
      lesson_id: null,
      asset_type: "cover",
      placement: "course_cover",
      source: "ai_generated",
      prompt: buildCourseCoverPrompt(courseRow),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${draft.course.title} course cover illustration`,
      caption: draft.course.title,
      metadata: {
        jobId: job.id,
        required: false,
        targetKind: "course_cover",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: generatedTree.mediaRows.length,
    },
    {
      course_id: courseId,
      lesson_id: null,
      asset_type: "thumbnail",
      placement: "course_thumbnail",
      source: "ai_generated",
      prompt: buildCourseThumbnailPrompt(courseRow),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${draft.course.title} course thumbnail`,
      caption: draft.course.title,
      metadata: {
        jobId: job.id,
        required: true,
        targetKind: "course_thumbnail",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: generatedTree.mediaRows.length + 1,
    },
  );

  await materializeAiCourseTextJob(supabase, {
    courseRow,
    courseUpdate: null,
    entityId: courseId,
    generatedTree,
    jobId: job.id,
    jobResult: {
      courseId,
      title: draft.course.title,
      lessonCount: draft.lessons.length,
      mediaAssetCount: generatedTree.mediaRows.length,
    },
  });

  await insertAuditEvent(supabase, getPromptString(job.prompt, "actorUserId"), "ai_course_draft_generated", "course", courseId, {
    topic: input.topic,
    audience: input.audience,
    region: input.region,
    lessonCount: draft.lessons.length,
    questionsPerLesson: input.questionsPerLesson,
    jobId: job.id,
  });

  revalidateLearningPaths(courseId, generatedTree.lessonIds);

  return {
    courseId,
    lessonIds: generatedTree.lessonIds,
    mode: "create_course",
  };
}

async function processExtendCourseTextJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: AiGenerationClaim,
) {
  const input = getPromptInput(job.prompt);
  const courseId = getPromptString(job.prompt, "courseId");
  const continuityInstruction = getPromptString(job.prompt, "continuityInstruction");

  if (!courseId) {
    throw new ValidationError("AI course extension job is missing a course id.");
  }

  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new ValidationError("AI course extension job is missing required prompt fields.");
  }

  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  const extensionContext = buildCourseExtensionContext(course, lessons, continuityInstruction);
  const draft = await generateAiLessonExtension(input, extensionContext);
  ensureNoDuplicateLessonTitles(lessons, draft.lessons);

  const nextSortOrder = lessons.reduce((max, lesson) => Math.max(max, lesson.sort_order), 0) + 1;
  const generatedTree = buildGeneratedLessonTreeRows({
    courseId,
    lessons: draft.lessons,
    jobId: job.id,
    startingSortOrder: nextSortOrder,
  });

  await materializeAiCourseTextJob(supabase, {
    courseRow: null,
    courseUpdate: {
      ai_generated: true,
      ai_text_status: "draft",
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      text_approved_at: null,
      text_approved_by: null,
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: {
        ...buildCourseNotes(input, job.id, draft, "extend_course"),
        extendedCourseId: courseId,
        addedLessonCount: draft.lessons.length,
        continuityInstruction: continuityInstruction || null,
      },
    },
    entityId: courseId,
    generatedTree,
    jobId: job.id,
    jobResult: {
      mode: "extend_course",
      courseId,
      addedLessonCount: draft.lessons.length,
      lessonIds: generatedTree.lessonIds,
      mediaAssetCount: generatedTree.mediaRows.length,
    },
  });

  await insertAuditEvent(supabase, getPromptString(job.prompt, "actorUserId"), "ai_course_extended_with_lessons", "course", courseId, {
    jobId: job.id,
    addedLessonCount: draft.lessons.length,
    lessonIds: generatedTree.lessonIds,
  });

  revalidateLearningPaths(courseId, generatedTree.lessonIds);

  return {
    courseId,
    lessonIds: generatedTree.lessonIds,
    mode: "extend_course",
  };
}

async function processReviseCourseTextJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: AiGenerationClaim,
) {
  const courseId = getPromptString(job.prompt, "courseId");
  const feedback = getPromptString(job.prompt, "feedback").trim();
  const actorUserId = getPromptString(job.prompt, "actorUserId");

  if (!courseId) {
    throw new ValidationError("AI course revision job is missing a course id.");
  }

  if (!actorUserId) {
    throw new ValidationError("AI course revision job is missing an actor user id.");
  }

  if (!feedback) {
    throw new ValidationError("AI course revision job is missing requested text changes.");
  }

  const revisionData = await getCourseRevisionData(supabase, courseId);
  const { course, lessons, pages, quizzes, blocks, questions } = revisionData;
  ensureAiCourse(course);

  if (course.status === "published") {
    throw new ValidationError("Disable the course before revising AI text because published courses do not have a separate draft version yet.");
  }

  const storedFeedback = getLatestTextRevisionFeedback(asRecord(course.ai_generation_notes));
  const generatedFrom = getGeneratedFromInput(course);
  const questionsPerLesson = Math.max(
    getRecommendedQuestionCountForRevision(course.level),
    questions.reduce((max, question) => Math.max(max, question.question_order), 0),
  );

  const input = clampAiGenerationRequest({
    topic: course.title,
    audience: generatedFrom.audience,
    region: generatedFrom.region,
    difficulty: course.level,
    tone: generatedFrom.tone,
    lessonCount: lessons.length,
    questionsPerLesson,
    notes: buildCourseRevisionNotes({
      course,
      lessons,
      pages,
      blocks,
      quizzes,
      questions,
      feedback,
    }),
  });

  const draft = await generateAiCourseDraftFromModel(input);
  ensureNoDuplicateLessonTitles([], draft.lessons);

  const generatedTree = buildGeneratedLessonTreeRows({
    courseId,
    lessons: draft.lessons,
    jobId: job.id,
    startingSortOrder: 1,
  });

  generatedTree.mediaRows.push(
    {
      course_id: courseId,
      lesson_id: null,
      asset_type: "cover",
      placement: "course_cover",
      source: "ai_generated",
      prompt: buildCourseCoverPrompt(draft.course),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${draft.course.title} course cover illustration`,
      caption: draft.course.title,
      metadata: {
        jobId: job.id,
        required: false,
        targetKind: "course_cover",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: generatedTree.mediaRows.length,
    },
    {
      course_id: courseId,
      lesson_id: null,
      asset_type: "thumbnail",
      placement: "course_thumbnail",
      source: "ai_generated",
      prompt: buildCourseThumbnailPrompt(draft.course),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${draft.course.title} course thumbnail`,
      caption: draft.course.title,
      metadata: {
        jobId: job.id,
        required: true,
        targetKind: "course_thumbnail",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: generatedTree.mediaRows.length + 1,
    },
  );

  const revisionNotesBase = appendTextRevisionFeedback(asRecord(course.ai_generation_notes), {
    kind: "applied",
    feedback,
    requestedAt: storedFeedback?.requestedAt ?? new Date().toISOString(),
    requestedBy: storedFeedback?.requestedBy ?? actorUserId,
    revisedAt: new Date().toISOString(),
    revisedBy: actorUserId,
    jobId: job.id,
  });

  const nextCourseNotes = {
    ...revisionNotesBase,
    ...buildCourseNotes(input, job.id, draft, "revise_course"),
    sourceCourseId: courseId,
    revisedFromTitle: course.title,
    latestTextRevisionFeedback: feedback,
    latestTextRevisionAt: new Date().toISOString(),
  };

  await replaceAiCourseTextJob(supabase, {
    courseUpdate: {
      title: draft.course.title,
      description: draft.course.description,
      category: draft.course.category,
      level: draft.course.level,
      estimated_minutes: draft.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0),
      ai_generated: true,
      ai_text_status: "draft",
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      text_approved_at: null,
      text_approved_by: null,
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: nextCourseNotes,
    },
    entityId: courseId,
    generatedTree,
    jobId: job.id,
    jobResult: {
      mode: "revise_course",
      courseId,
      title: draft.course.title,
      lessonCount: draft.lessons.length,
      mediaAssetCount: generatedTree.mediaRows.length,
    },
  });

  await insertAuditEvent(supabase, actorUserId, "ai_course_text_revised", "course", courseId, {
    jobId: job.id,
    feedback,
    revisedTitle: draft.course.title,
    lessonCount: draft.lessons.length,
  });

  revalidateLearningPaths(courseId, generatedTree.lessonIds);

  return {
    courseId,
    lessonIds: generatedTree.lessonIds,
    mode: "revise_course",
  };
}

async function processCourseMediaAssetsJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: AiGenerationClaim,
) {
  const courseId = getPromptString(job.prompt, "courseId");
  const actorUserId = getPromptString(job.prompt, "actorUserId");
  const replaceExisting = getPromptBoolean(job.prompt, "replaceExisting");
  const applyMediaFeedback = getPromptBoolean(job.prompt, "applyMediaFeedback");
  const mediaFeedback = getPromptString(job.prompt, "mediaFeedback").trim();
  const mediaConfig = getAiMediaConfig();

  if (!courseId) {
    throw new ValidationError("AI course media job is missing a course id.");
  }

  if (!actorUserId) {
    throw new ValidationError("AI course media job is missing an actor user id.");
  }

  if (!mediaConfig.canGenerate) {
    throw new ValidationError(
      `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
    );
  }

  const { course, lessons, pages } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (course.ai_text_status !== "approved") {
    throw new ValidationError("Approve the course text before generating media.");
  }

  if (applyMediaFeedback && !mediaFeedback) {
    throw new ValidationError("AI course media job is missing requested media changes.");
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  const storedMediaFeedback = getLatestMediaRevisionFeedback(asRecord(course.ai_generation_notes));
  const { data: existingAssets, error: assetsError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (assetsError) throw assetsError;

  const typedExistingAssets = (existingAssets ?? []) as WorkflowMediaAssetRow[];
  const seedRows = createCourseMediaSeedRows(course, lessons, pages, typedExistingAssets, job.id);
  if (seedRows.length > 0) {
    const { error } = await supabase
      .from("learning_media_assets")
      .insert(seedRows as LearningMediaAssetInsert[]);
    if (error) throw error;
  }

  const { data: refreshedAssetsData, error: refreshedAssetsError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (refreshedAssetsError) throw refreshedAssetsError;

  const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>();
  for (const page of pages) {
    const current = pagesByLessonId.get(page.lesson_id) ?? [];
    current.push(page);
    pagesByLessonId.set(page.lesson_id, current);
  }

  const imageAssets = ((refreshedAssetsData ?? []) as WorkflowMediaAssetRow[]).filter(isImageMediaAsset);
  const usedTargetKeys = new Set<string>();
  const usedPageIds = new Set<string>();
  const workItems: MediaGenerationWorkItem[] = [];
  let skippedCount = 0;

  for (const asset of imageAssets) {
    if (isGenerationExcludedMediaAsset(asset)) {
      skippedCount += 1;
      continue;
    }

    const target = resolveMediaTarget(asset, pagesByLessonId, usedPageIds);
    if (!target) {
      skippedCount += 1;
      await updateAssetForSkip(
        supabase,
        asset.id,
        "skipped",
        "Skipped because no supported lesson page target could be resolved for this asset.",
      );
      continue;
    }

    if (usedTargetKeys.has(target.key)) {
      skippedCount += 1;
      await updateAssetForSkip(
        supabase,
        asset.id,
        "skipped",
        "Skipped because this run only generates one image for each supported course, lesson, or page target.",
      );
      continue;
    }

    usedTargetKeys.add(target.key);
    if (target.kind === "page_cover") {
      usedPageIds.add(target.pageId);
    }

    const lesson = asset.lesson_id ? lessons.find((row) => row.id === asset.lesson_id) ?? null : null;
    const page = target.kind === "page_cover" || target.kind === "page_block"
      ? pages.find((row) => row.id === target.pageId) ?? null
      : null;

    workItems.push({
      asset,
      target,
      context: {
        courseId: course.id,
        courseTitle: course.title,
        courseDescription: course.description,
        courseCategory: course.category,
        lessonId: lesson?.id ?? null,
        lessonTitle: lesson?.title ?? null,
        lessonDescription: lesson?.description ?? null,
        pageId: page?.id ?? null,
        pageTitle: page?.title ?? null,
        pageSubtitle: page?.subtitle ?? null,
        placementLabel: asset.placement,
        revisionFeedback: applyMediaFeedback ? mediaFeedback : null,
        targetKind: target.kind,
      },
    });
  }

  const counts = await processMediaGenerationWorkItems(supabase, workItems, replaceExisting, skippedCount);

  const { error: mediaStatusError } = await supabase.rpc("admin_reset_ai_course_media", {
    p_course_id: courseId,
    p_media_status: "draft",
  });

  if (mediaStatusError) throw mediaStatusError;

  if (applyMediaFeedback && mediaFeedback) {
    const nextNotes = appendMediaRevisionFeedback(asRecord(course.ai_generation_notes), {
      kind: "applied",
      feedback: mediaFeedback,
      requestedAt: storedMediaFeedback?.requestedAt ?? new Date().toISOString(),
      requestedBy: storedMediaFeedback?.requestedBy ?? actorUserId,
      revisedAt: new Date().toISOString(),
      revisedBy: actorUserId,
      jobId: job.id,
    });

    const { error } = await supabase
      .from("courses")
      .update({ ai_generation_notes: nextNotes })
      .eq("id", courseId);

    if (error) throw error;
  }

  const jobStatus = counts.generatedCount > 0 || counts.reusedCount > 0 || counts.skippedCount > 0
    ? "completed"
    : "failed";

  const result = {
    courseId,
    imageAssetCount: imageAssets.length,
    lessonCount: lessons.length,
    mediaFeedbackApplied: applyMediaFeedback,
    replaceExisting,
    ...counts,
  };

  await updateJob(supabase, job.id, {
    entity_id: courseId,
    status: jobStatus,
    result,
    error: jobStatus === "failed" ? "No media images were generated successfully." : null,
  });

  await insertAuditEvent(supabase, actorUserId, "ai_course_media_assets_generated", "course", courseId, {
    jobId: job.id,
    ...counts,
    replaceExisting,
    mediaFeedbackApplied: applyMediaFeedback,
  });

  revalidateLearningPaths(courseId, lessonIds);

  return {
    mode: "course_media",
    status: jobStatus,
    ...result,
  };
}

async function processLessonMediaAssetsJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: AiGenerationClaim,
) {
  const courseId = getPromptString(job.prompt, "courseId");
  const lessonId = getPromptString(job.prompt, "lessonId");
  const actorUserId = getPromptString(job.prompt, "actorUserId");
  const replaceExisting = getPromptBoolean(job.prompt, "replaceExisting");
  const applyMediaFeedback = getPromptBoolean(job.prompt, "applyMediaFeedback");
  const mediaFeedback = getPromptString(job.prompt, "mediaFeedback").trim();
  const mediaConfig = getAiMediaConfig();

  if (!courseId) {
    throw new ValidationError("AI lesson media job is missing a course id.");
  }

  if (!lessonId) {
    throw new ValidationError("AI lesson media job is missing a lesson id.");
  }

  if (!actorUserId) {
    throw new ValidationError("AI lesson media job is missing an actor user id.");
  }

  if (!mediaConfig.canGenerate) {
    throw new ValidationError(
      `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
    );
  }

  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, lessonPages, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  if (course.id !== courseId) {
    throw new ValidationError("AI lesson media job course id does not match the lesson.");
  }

  if (lesson.ai_text_status !== "approved") {
    throw new ValidationError("Approve this lesson's text before generating lesson media.");
  }

  if (applyMediaFeedback && !mediaFeedback) {
    throw new ValidationError("AI lesson media job is missing requested media changes.");
  }

  const storedMediaFeedback = getLatestMediaRevisionFeedback(asRecord(lesson.ai_generation_notes));
  const lessonIds = lessons.map((item) => item.id);
  const courseAssets = await getCourseMediaAssets(supabase, course.id);
  const existingLessonAssets = courseAssets.filter((asset) => asset.lesson_id === lessonId);
  const seedRows = createLessonMediaSeedRows(course, lesson, lessonPages, existingLessonAssets, job.id);

  if (seedRows.length > 0) {
    const { error } = await supabase
      .from("learning_media_assets")
      .insert(seedRows as LearningMediaAssetInsert[]);
    if (error) throw error;
  }

  const lessonAssets = (await getCourseMediaAssets(supabase, course.id))
    .filter((asset) => asset.lesson_id === lessonId);
  const imageAssets = lessonAssets.filter(isImageMediaAsset);
  const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>([[lessonId, lessonPages]]);
  const usedTargetKeys = new Set<string>();
  const usedPageIds = new Set<string>();
  const workItems: MediaGenerationWorkItem[] = [];
  let skippedCount = 0;

  for (const asset of imageAssets) {
    if (isGenerationExcludedMediaAsset(asset)) {
      skippedCount += 1;
      continue;
    }

    const target = resolveMediaTarget(asset, pagesByLessonId, usedPageIds);
    if (!target) {
      skippedCount += 1;
      await updateAssetForSkip(
        supabase,
        asset.id,
        "skipped",
        "Skipped because no supported lesson page target could be resolved for this asset.",
      );
      continue;
    }

    if (usedTargetKeys.has(target.key)) {
      skippedCount += 1;
      await updateAssetForSkip(
        supabase,
        asset.id,
        "skipped",
        "Skipped because this run only generates one image for each supported lesson target.",
      );
      continue;
    }

    usedTargetKeys.add(target.key);
    if (target.kind === "page_cover") {
      usedPageIds.add(target.pageId);
    }

    const page = target.kind === "page_cover" || target.kind === "page_block"
      ? lessonPages.find((row) => row.id === target.pageId) ?? null
      : null;

    workItems.push({
      asset,
      target,
      context: {
        courseId: course.id,
        courseTitle: course.title,
        courseDescription: course.description,
        courseCategory: course.category,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonDescription: lesson.description,
        pageId: page?.id ?? null,
        pageTitle: page?.title ?? null,
        pageSubtitle: page?.subtitle ?? null,
        placementLabel: asset.placement,
        revisionFeedback: applyMediaFeedback ? mediaFeedback : null,
        targetKind: target.kind,
      },
    });
  }

  const counts = await processMediaGenerationWorkItems(supabase, workItems, replaceExisting, skippedCount);

  const { error: mediaStatusError } = await supabase.rpc("admin_reset_ai_course_media", {
    p_course_id: course.id,
    p_lesson_id: lessonId,
    p_media_status: "draft",
  });

  if (mediaStatusError) throw mediaStatusError;

  if (applyMediaFeedback && mediaFeedback) {
    const nextNotes = appendMediaRevisionFeedback(asRecord(lesson.ai_generation_notes), {
      kind: "applied",
      feedback: mediaFeedback,
      requestedAt: storedMediaFeedback?.requestedAt ?? new Date().toISOString(),
      requestedBy: storedMediaFeedback?.requestedBy ?? actorUserId,
      revisedAt: new Date().toISOString(),
      revisedBy: actorUserId,
      jobId: job.id,
    });

    const { error } = await supabase
      .from("lessons")
      .update({ ai_generation_notes: nextNotes })
      .eq("id", lessonId);

    if (error) throw error;
  }

  const jobStatus = counts.generatedCount > 0 || counts.reusedCount > 0 || counts.skippedCount > 0
    ? "completed"
    : "failed";
  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, actorUserId);
  const result = {
    courseId: course.id,
    imageAssetCount: imageAssets.length,
    lessonId,
    mediaFeedbackApplied: applyMediaFeedback,
    replaceExisting,
    ...counts,
  };

  await updateJob(supabase, job.id, {
    entity_id: course.id,
    status: jobStatus,
    result,
    error: jobStatus === "failed" ? "No lesson media images were generated successfully." : null,
  });

  await insertAuditEvent(supabase, actorUserId, "ai_lesson_media_assets_generated", "lesson", lessonId, {
    courseId: course.id,
    jobId: job.id,
    ...counts,
    replaceExisting,
    mediaFeedbackApplied: applyMediaFeedback,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  revalidateLearningPaths(course.id, lessonIds);

  return {
    mode: "lesson_media",
    status: jobStatus,
    ...result,
  };
}

async function processSingleMediaAssetJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: AiGenerationClaim,
) {
  const actorUserId = getPromptString(job.prompt, "actorUserId");
  const assetId = getPromptString(job.prompt, "assetId");
  const courseId = getPromptString(job.prompt, "courseId");
  const mediaConfig = getAiMediaConfig();

  if (!actorUserId) {
    throw new ValidationError("AI media asset job is missing an actor user id.");
  }

  if (!assetId) {
    throw new ValidationError("AI media asset job is missing an asset id.");
  }

  if (!courseId) {
    throw new ValidationError("AI media asset job is missing a course id.");
  }

  if (!mediaConfig.canGenerate) {
    throw new ValidationError(
      `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
    );
  }

  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, lessons, pages } = workflow;
  ensureAiCourse(course);

  const asset = await getLearningMediaAssetById(supabase, assetId);
  if (asset.course_id !== courseId) {
    throw new ValidationError("This media asset does not belong to this course.");
  }

  if (!isImageMediaAsset(asset)) {
    throw new ValidationError("This media slot is not an image-based media type yet.");
  }

  if (isGenerationExcludedMediaAsset(asset)) {
    throw new ValidationError("This optional media slot is excluded from generation.");
  }

  const lesson = asset.lesson_id
    ? lessons.find((item) => item.id === asset.lesson_id) ?? null
    : null;

  if (asset.lesson_id) {
    if (!lesson) {
      throw new ValidationError("Media asset lesson not found.");
    }
    ensureAiLesson(lesson);
    if (lesson.ai_text_status !== "approved") {
      throw new ValidationError("Approve this lesson's text before generating this media.");
    }
  } else if (course.ai_text_status !== "approved") {
    throw new ValidationError("Approve the course text before generating this media.");
  }

  const target = resolveMediaTarget(asset, buildPagesByLessonId(pages), new Set<string>());
  if (!target) {
    throw new ValidationError("This media slot does not have a supported target.");
  }

  const page = target.kind === "page_cover" || target.kind === "page_block"
    ? pages.find((row) => row.id === target.pageId) ?? null
    : null;

  const counts = await processMediaGenerationWorkItems(
    supabase,
    [
      {
        asset,
        target,
        context: {
          courseId: course.id,
          courseTitle: course.title,
          courseDescription: course.description,
          courseCategory: course.category,
          lessonId: lesson?.id ?? null,
          lessonTitle: lesson?.title ?? null,
          lessonDescription: lesson?.description ?? null,
          pageId: page?.id ?? null,
          pageTitle: page?.title ?? null,
          pageSubtitle: page?.subtitle ?? null,
          placementLabel: asset.placement,
          revisionFeedback: null,
          targetKind: target.kind,
        },
      },
    ],
    true,
    0,
  );

  await resetMediaApprovalAfterAssetChange(supabase, courseId, asset.lesson_id);
  const aggregate = await recomputeCourseAiStatuses(supabase, courseId, actorUserId);
  const jobStatus = counts.generatedCount > 0 || counts.reusedCount > 0 ? "completed" : "failed";
  const result = {
    assetId,
    courseId,
    lessonId: asset.lesson_id,
    mediaFeedbackApplied: false,
    replaceExisting: true,
    targetKind: target.kind,
    ...counts,
  };

  await updateJob(supabase, job.id, {
    entity_id: courseId,
    status: jobStatus,
    result,
    error: jobStatus === "failed" ? "Media generation failed." : null,
  });

  await insertAuditEvent(supabase, actorUserId, "learning_media_asset_generated", "media_asset", assetId, {
    courseId,
    lessonId: asset.lesson_id,
    jobId: job.id,
    targetKind: target.kind,
    courseMediaStatus: aggregate.nextMediaStatus,
    replacedExisting: true,
    ...counts,
  });

  revalidateLearningPaths(courseId, asset.lesson_id ? [asset.lesson_id] : []);

  return {
    mode: "single_media_asset",
    status: jobStatus,
    ...result,
  };
}

async function normalizeMediaAssetsJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: AiGenerationClaim,
): Promise<AiGenerationClaim> {
  const mode = getMediaJobMode(job.prompt);
  const actorUserId = getPromptString(job.prompt, "actorUserId");
  const courseId = getPromptString(job.prompt, "courseId") || job.entity_id || "";
  const mediaFeedback = getPromptString(job.prompt, "mediaFeedback").trim();

  if (
    mode === getPromptString(job.prompt, "mode")
    && actorUserId
    && (courseId === getPromptString(job.prompt, "courseId") || !job.entity_id)
  ) {
    return job;
  }

  return {
    ...job,
    prompt: {
      ...job.prompt,
      ...(mode ? { mode } : {}),
      ...(courseId ? { courseId } : {}),
      ...(typeof job.prompt.applyMediaFeedback === "boolean" || !mediaFeedback
        ? {}
        : { applyMediaFeedback: true }),
      actorUserId: actorUserId || await getJobActorUserId(supabase, job.id),
    },
  };
}

export async function processNextAiGenerationJob(workerId: string) {
  const supabase = createSupabaseAdminClient();
  const job = await claimNextAiGenerationJob(supabase, workerId);

  if (!job) {
    return {
      processed: false,
      status: "idle" as const,
    };
  }

  try {
    if (job.job_type === "media_assets") {
      const mediaJob = await normalizeMediaAssetsJob(supabase, job);
      const mode = getMediaJobMode(mediaJob.prompt);
      const result =
        mode === "course_media"
          ? await processCourseMediaAssetsJob(supabase, mediaJob)
          : mode === "lesson_media"
            ? await processLessonMediaAssetsJob(supabase, mediaJob)
            : mode === "single_media_asset"
              ? await processSingleMediaAssetJob(supabase, mediaJob)
            : (() => {
                throw new ValidationError(`Unsupported AI media job mode: ${mode}`);
              })();

      return {
        jobId: job.id,
        processed: true,
        result,
        status: result.status === "failed" ? "failed" as const : "completed" as const,
      };
    }

    if (job.job_type !== "course_text") {
      throw new ValidationError(`Unsupported AI generation job type: ${job.job_type}`);
    }

    const mode = getPromptString(job.prompt, "mode");
    const result =
      mode === "create_course"
        ? await processCreateCourseTextJob(supabase, job)
        : mode === "extend_course"
          ? await processExtendCourseTextJob(supabase, job)
          : mode === "revise_course"
            ? await processReviseCourseTextJob(supabase, job)
          : (() => {
              throw new ValidationError(`Unsupported AI course text job mode: ${mode}`);
            })();

    return {
      jobId: job.id,
      processed: true,
      result,
      status: "completed" as const,
    };
  } catch (error) {
    const isValidationError = isValidationFailure(error);
    const retry = !isValidationError && job.attempt_count < 3;
    await markAiGenerationJobFailed(supabase, job.id, error, retry).catch((failureError) => {
      logAppError(failureError, {
        operation: "admin.ai_generation_job.fail",
        resourceId: job.id,
      });
    });

    if (isValidationError) {
      return {
        jobId: job.id,
        processed: true,
        result: {
          error: error instanceof Error ? error.message : "AI generation job failed validation.",
          failureCode: "validation_error",
          retry,
        },
        status: "failed" as const,
      };
    }

    throw error;
  }
}

export async function generateAiCourseDraft(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, profile } = admin;
  const input = parseAiGenerationInput(formData);

  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new Error("Topic, target audience, country or region, and tone are required.");
  }

  const jobId = await enqueueCourseTextJob(supabase, profile.id, {
    actorUserId: profile.id,
    mode: "create_course",
    ...input,
  });

  revalidatePath("/admin/courses");
  redirect(
    appendAdminNotice(
      "/admin/courses",
      `AI course draft generation queued. Job ${jobId} will materialize the course when the worker runs.`,
    ),
  );
}

export async function extendCourseWithAiLessons(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const input = parseAiGenerationInput(formData);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const continuityInstruction = getContinuityInstruction(formData);

  if (!courseId) {
    throw new Error("Select a course to extend.");
  }

  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new Error("Topic, target audience, country or region, and tone are required.");
  }

  const { course } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  const jobId = await enqueueCourseTextJob(
    supabase,
    profile.id,
    {
      actorUserId: profile.id,
      mode: "extend_course",
      courseId,
      continuityInstruction,
      ...input,
    },
    courseId,
  );

  revalidatePath(`/admin/courses/${courseId}`);
  redirect(
    appendAdminNotice(
      `/admin/courses/${courseId}`,
      `AI lesson generation queued. Job ${jobId} will add the lessons when the worker runs.`,
    ),
  );
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
  const feedback = parseRequiredChangeRequest(formData, "changeRequest");
  const nextNotes = appendTextRevisionFeedback(asRecord(course.ai_generation_notes), {
    kind: "request",
    feedback,
    requestedAt: new Date().toISOString(),
    requestedBy: profile.id,
  });

  const { error } = await supabase.rpc("admin_reset_ai_course_tree", {
    p_course_id: courseId,
    p_text_status: "changes_requested",
  });

  if (error) throw error;

  const { error: notesError } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: nextNotes,
    })
    .eq("id", courseId);

  if (notesError) throw notesError;

  await insertAuditEvent(supabase, profile.id, "ai_course_text_changes_requested", "course", courseId, {
    feedback,
  });

  revalidateLearningPaths(courseId, lessons.map((lesson) => lesson.id));
  redirect(appendAdminNotice(redirectTo, "Text changes requested. Media generation has been locked again."));
}

export async function approveLessonText(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, quiz, lessons } = workflow;
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  const approvedAt = new Date().toISOString();

  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_text_status: "approved",
      ai_media_status: "generation_ready",
      ai_publish_status: "not_ready",
      text_approved_at: approvedAt,
      text_approved_by: profile.id,
      media_approved_at: null,
      media_approved_by: null,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  if (quiz) {
    const { error: quizError } = await supabase
      .from("quizzes")
      .update({
        ai_text_status: "approved",
        text_approved_at: approvedAt,
        text_approved_by: profile.id,
      })
      .eq("id", quiz.id);

    if (quizError) throw quizError;
  }

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, profile.id);

  await insertAuditEvent(supabase, profile.id, "ai_lesson_text_approved", "lesson", lessonId, {
    courseId: course.id,
    approvedAt,
    courseTextStatus: aggregate.nextTextStatus,
  });

  revalidateLearningPaths(course.id, lessons.map((item) => item.id));
  redirect(appendAdminNotice(redirectTo, "Lesson text approved."));
}

export async function requestLessonTextChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, quiz, lessons } = workflow;
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const feedback = parseRequiredChangeRequest(formData, "changeRequest");
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  const nextNotes = appendTextRevisionFeedback(asRecord(lesson.ai_generation_notes), {
    kind: "request",
    feedback,
    requestedAt: new Date().toISOString(),
    requestedBy: profile.id,
  });

  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_text_status: "changes_requested",
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      text_approved_at: null,
      text_approved_by: null,
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: nextNotes,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  if (quiz) {
    const { error: quizError } = await supabase
      .from("quizzes")
      .update({
        ai_text_status: "changes_requested",
        text_approved_at: null,
        text_approved_by: null,
      })
      .eq("id", quiz.id);

    if (quizError) throw quizError;
  }

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, profile.id);

  await insertAuditEvent(supabase, profile.id, "ai_lesson_text_changes_requested", "lesson", lessonId, {
    courseId: course.id,
    feedback,
    courseTextStatus: aggregate.nextTextStatus,
  });

  revalidateLearningPaths(course.id, lessons.map((item) => item.id));
  redirect(appendAdminNotice(redirectTo, "Lesson text changes requested. Lesson media has been locked again."));
}

export async function reviseCourseTextWithAi(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const revisionData = await getCourseRevisionData(supabase, courseId);
  const { course } = revisionData;
  ensureAiCourse(course);

  if (course.status === "published") {
    throw new Error("Disable the course before revising AI text because published courses do not have a separate draft version yet.");
  }

  const storedFeedback = getLatestTextRevisionFeedback(asRecord(course.ai_generation_notes));
  const requestedFeedback = sanitizePlainTextInput(String(formData.get("revisionRequest") ?? ""), 3000).trim();
  const feedback = requestedFeedback || storedFeedback?.feedback || "";
  if (!feedback) {
    throw new Error("Add the requested text changes before revising with AI.");
  }

  const jobId = await enqueueCourseTextJob(
    supabase,
    profile.id,
    {
      actorUserId: profile.id,
      mode: "revise_course",
      courseId,
      feedback,
    },
    courseId,
  );

  revalidatePath(`/admin/courses/${courseId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `AI revision queued. Job ${jobId} will replace the course text when the worker runs.`,
    ),
  );
}

export async function generateCourseMediaAssets(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const replaceExisting = parseBooleanFlag(formData.get("replaceExisting"));
  const applyMediaFeedback = parseBooleanFlag(formData.get("applyMediaFeedback"));
  const mediaConfig = getAiMediaConfig();

  if (!mediaConfig.canGenerate) {
    redirect(
      appendAdminNotice(
        redirectTo,
        `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
      ),
    );
  }

  const { course } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);
  const storedMediaFeedback = getLatestMediaRevisionFeedback(asRecord(course.ai_generation_notes));
  const requestedMediaFeedback = sanitizePlainTextInput(String(formData.get("mediaRevisionRequest") ?? ""), 3000).trim();
  const mediaFeedback = requestedMediaFeedback || storedMediaFeedback?.feedback || "";

  if (course.ai_text_status !== "approved") {
    throw new Error("Approve the course text before generating media.");
  }

  if (applyMediaFeedback && !mediaFeedback) {
    throw new Error("Add the requested media changes before regenerating with AI.");
  }

  const jobId = await enqueueMediaAssetsJob(
    supabase,
    profile.id,
    {
      actorUserId: profile.id,
      courseId,
      mode: "course_media",
      replaceExisting,
      applyMediaFeedback,
      mediaFeedback: applyMediaFeedback ? mediaFeedback : null,
    },
    courseId,
  );

  revalidatePath(`/admin/courses/${courseId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `AI media generation queued. Job ${jobId} will generate course media when the worker runs.`,
    ),
  );
}

export async function generateCourseMediaDrafts(formData: FormData) {
  return generateCourseMediaAssets(formData);
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
  const { data: assets, error: assetQueryError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId);

  if (assetQueryError) throw assetQueryError;

  const typedAssets = (assets ?? []) as WorkflowMediaAssetRow[];
  const validation: MediaApprovalValidation<WorkflowMediaAssetRow> = validateMediaApproval(typedAssets);
  const hasRequiredImageAssets = typedAssets.some(isRequiredMediaAsset);
  if (
    !hasRequiredImageAssets
    ||
    validation.missingRequiredAssets.length > 0
    || validation.failedRequiredAssets.length > 0
  ) {
    throw new Error(
      "Required media assets are still missing, failed, or not seeded yet. Regenerate media and confirm the required previews before approval.",
    );
  }

  for (const asset of typedAssets) {
    const nextReviewStatus = getApprovedReviewStatus(asset);
    if (nextReviewStatus === asset.review_status) {
      continue;
    }

    const { error: assetReviewError } = await supabase
      .from("learning_media_assets")
      .update({ review_status: nextReviewStatus })
      .eq("id", asset.id);

    if (assetReviewError) throw assetReviewError;
  }

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

export async function approveCourseManualMedia(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (course.ai_text_status !== "approved") {
    throw new Error("Approve course text before approving manual media.");
  }

  const manualUrl = getImagePayloadString(course.thumbnail as Record<string, unknown> | null, "src");
  if (!manualUrl) {
    throw new Error("Add a course thumbnail before approving manual media.");
  }

  const now = new Date().toISOString();
  const lessonIds = lessons.map((lesson) => lesson.id);
  const assets = await getCourseMediaAssets(supabase, courseId);
  const courseAssets = assets.filter((asset) => asset.lesson_id === null);
  let requiredAsset = courseAssets.find((asset) => isRequiredMediaAsset(asset));

  if (!requiredAsset) {
    const { data: insertedAsset, error: insertError } = await supabase
      .from("learning_media_assets")
      .insert({
        course_id: course.id,
        lesson_id: null,
        asset_type: "thumbnail",
        placement: "course_thumbnail",
        source: "manual",
        prompt: "Editor-provided course media.",
        script: "",
        url: manualUrl,
        storage_path: null,
        provider: "manual",
        model: "manual",
        alt_text: getImagePayloadString(course.thumbnail as Record<string, unknown> | null, "alt") || `${course.title} course thumbnail`,
        caption: course.title,
        metadata: {
          required: true,
          targetKind: "course_thumbnail",
          manuallyApprovedAt: now,
          manuallyApprovedBy: profile.id,
        },
        review_status: "approved",
        generation_status: "skipped",
        generation_error: null,
        sort_order: courseAssets.reduce((max, asset) => Math.max(max, asset.sort_order), -1) + 1,
      })
      .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
      .single();

    if (insertError) throw insertError;
    requiredAsset = insertedAsset as WorkflowMediaAssetRow;
  } else {
    const { error: updateAssetError } = await supabase
      .from("learning_media_assets")
      .update({
        source: "manual",
        url: manualUrl,
        provider: "manual",
        model: "manual",
        alt_text: getImagePayloadString(course.thumbnail as Record<string, unknown> | null, "alt") || requiredAsset.alt_text || `${course.title} course thumbnail`,
        caption: requiredAsset.caption || course.title,
        review_status: "approved",
        generation_status: "skipped",
        generation_error: null,
        metadata: {
          ...asRecord(requiredAsset.metadata),
          required: true,
          targetKind: getMetadataString(asRecord(requiredAsset.metadata), "targetKind") || "course_thumbnail",
          manuallyApprovedAt: now,
          manuallyApprovedBy: profile.id,
        },
      })
      .eq("id", requiredAsset.id);

    if (updateAssetError) throw updateAssetError;
  }

  const aggregate = await recomputeCourseAiStatuses(supabase, courseId, profile.id);

  await insertAuditEvent(supabase, profile.id, "ai_course_manual_media_approved", "course", courseId, {
    approvedAt: now,
    assetId: requiredAsset.id,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  revalidateLearningPaths(courseId, lessonIds);
  redirect(appendAdminNotice(redirectTo, "Manual course media approved."));
}

export async function requestCourseMediaChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  const feedback = parseRequiredChangeRequest(formData, "mediaChangeRequest");
  ensureAiCourse(course);
  const nextNotes = appendMediaRevisionFeedback(asRecord(course.ai_generation_notes), {
    kind: "request",
    feedback,
    requestedAt: new Date().toISOString(),
    requestedBy: profile.id,
  });

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
      ai_generation_notes: nextNotes,
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

  await insertAuditEvent(supabase, profile.id, "ai_course_media_changes_requested", "course", courseId, {
    feedback,
  });

  revalidateLearningPaths(courseId, lessonIds);
  redirect(appendAdminNotice(redirectTo, "Media changes requested. Publishing has been locked again."));
}

export async function generateLessonMediaAssets(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const replaceExisting = parseBooleanFlag(formData.get("replaceExisting"));
  const applyMediaFeedback = parseBooleanFlag(formData.get("applyMediaFeedback"));
  const mediaConfig = getAiMediaConfig();

  if (!mediaConfig.canGenerate) {
    redirect(
      appendAdminNotice(
        redirectTo,
        `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
      ),
    );
  }

  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);
  const storedMediaFeedback = getLatestMediaRevisionFeedback(asRecord(lesson.ai_generation_notes));
  const requestedMediaFeedback = sanitizePlainTextInput(String(formData.get("mediaRevisionRequest") ?? ""), 3000).trim();
  const mediaFeedback = requestedMediaFeedback || storedMediaFeedback?.feedback || "";

  if (lesson.ai_text_status !== "approved") {
    throw new Error("Approve this lesson's text before generating lesson media.");
  }

  if (applyMediaFeedback && !mediaFeedback) {
    throw new Error("Add the requested media changes before regenerating with AI.");
  }

  const jobId = await enqueueMediaAssetsJob(
    supabase,
    profile.id,
    {
      actorUserId: profile.id,
      courseId: course.id,
      lessonId,
      mode: "lesson_media",
      replaceExisting,
      applyMediaFeedback,
      mediaFeedback: applyMediaFeedback ? mediaFeedback : null,
    },
    course.id,
  );

  revalidatePath(`/admin/courses/lessons/${lessonId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `AI lesson media generation queued. Job ${jobId} will generate lesson media when the worker runs.`,
    ),
  );
}

export async function approveLessonMedia(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  if (lesson.ai_text_status !== "approved") {
    throw new Error("Approve this lesson's text before approving lesson media.");
  }

  const lessonAssets = (await getCourseMediaAssets(supabase, course.id))
    .filter((asset) => asset.lesson_id === lessonId);
  const validation: MediaApprovalValidation<WorkflowMediaAssetRow> = validateMediaApproval(lessonAssets);
  const hasRequiredImageAssets = lessonAssets.some(isRequiredMediaAsset);

  if (
    !hasRequiredImageAssets
    || validation.missingRequiredAssets.length > 0
    || validation.failedRequiredAssets.length > 0
  ) {
    throw new Error(
      "Required lesson media assets are still missing, failed, or not seeded yet. Generate lesson media and confirm the required previews before approval.",
    );
  }

  for (const asset of lessonAssets) {
    const nextReviewStatus = getApprovedReviewStatus(asset);
    if (nextReviewStatus === asset.review_status) {
      continue;
    }

    const { error: assetReviewError } = await supabase
      .from("learning_media_assets")
      .update({ review_status: nextReviewStatus })
      .eq("id", asset.id);

    if (assetReviewError) throw assetReviewError;
  }

  const approvedAt = new Date().toISOString();
  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_media_status: "approved",
      ai_publish_status: "ready",
      media_approved_at: approvedAt,
      media_approved_by: profile.id,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, profile.id);

  await insertAuditEvent(supabase, profile.id, "ai_lesson_media_approved", "lesson", lessonId, {
    courseId: course.id,
    approvedAt,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  revalidateLearningPaths(course.id, lessons.map((item) => item.id));
  redirect(appendAdminNotice(redirectTo, "Lesson media approved."));
}

export async function approveLessonManualMedia(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  if (lesson.ai_text_status !== "approved") {
    throw new Error("Approve this lesson's text before approving manual media.");
  }

  const manualUrl = getImagePayloadString(lesson.cover_image as Record<string, unknown> | null, "src");
  if (!manualUrl) {
    throw new Error("Add a lesson thumbnail or cover image before approving manual media.");
  }

  const existingAssets = (await getCourseMediaAssets(supabase, course.id))
    .filter((asset) => asset.lesson_id === lessonId);
  let requiredAsset = existingAssets.find((asset) => isRequiredMediaAsset(asset));
  const now = new Date().toISOString();

  if (!requiredAsset) {
    const { data: insertedAsset, error: insertError } = await supabase
      .from("learning_media_assets")
      .insert({
        course_id: course.id,
        lesson_id: lesson.id,
        asset_type: "thumbnail",
        placement: "lesson_thumbnail",
        source: "manual",
        prompt: "Editor-provided lesson media.",
        script: "",
        url: manualUrl,
        storage_path: null,
        provider: "manual",
        model: "manual",
        alt_text: getImagePayloadString(lesson.cover_image as Record<string, unknown> | null, "alt") || `${lesson.title} lesson image`,
        caption: lesson.title,
        metadata: {
          required: true,
          targetKind: "lesson_thumbnail",
          manuallyApprovedAt: now,
          manuallyApprovedBy: profile.id,
        },
        review_status: "approved",
        generation_status: "skipped",
        generation_error: null,
        sort_order: existingAssets.reduce((max, asset) => Math.max(max, asset.sort_order), -1) + 1,
      })
      .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
      .single();

    if (insertError) throw insertError;
    requiredAsset = insertedAsset as WorkflowMediaAssetRow;
  } else {
    const { error: updateAssetError } = await supabase
      .from("learning_media_assets")
      .update({
        source: "manual",
        url: manualUrl,
        provider: "manual",
        model: "manual",
        alt_text: getImagePayloadString(lesson.cover_image as Record<string, unknown> | null, "alt") || requiredAsset.alt_text || `${lesson.title} lesson image`,
        caption: requiredAsset.caption || lesson.title,
        review_status: "approved",
        generation_status: "skipped",
        generation_error: null,
        metadata: {
          ...asRecord(requiredAsset.metadata),
          required: true,
          targetKind: getMetadataString(asRecord(requiredAsset.metadata), "targetKind") || "lesson_thumbnail",
          manuallyApprovedAt: now,
          manuallyApprovedBy: profile.id,
        },
      })
      .eq("id", requiredAsset.id);

    if (updateAssetError) throw updateAssetError;
  }

  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_media_status: "approved",
      ai_publish_status: "ready",
      media_approved_at: now,
      media_approved_by: profile.id,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, profile.id);

  await insertAuditEvent(supabase, profile.id, "ai_lesson_manual_media_approved", "lesson", lessonId, {
    courseId: course.id,
    approvedAt: now,
    assetId: requiredAsset.id,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  revalidateLearningPaths(course.id, lessons.map((item) => item.id));
  redirect(appendAdminNotice(redirectTo, "Manual lesson media approved."));
}

async function getLearningMediaAssetById(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  assetId: string,
) {
  const { data, error } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("id", assetId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Media asset not found.");
  }

  return data as WorkflowMediaAssetRow;
}

function buildPagesByLessonId(pages: WorkflowLessonPageRow[]) {
  const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>();
  for (const page of pages) {
    const current = pagesByLessonId.get(page.lesson_id) ?? [];
    current.push(page);
    pagesByLessonId.set(page.lesson_id, current);
  }

  return pagesByLessonId;
}

async function resetMediaApprovalAfterAssetChange(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
  lessonId: string | null,
) {
  if (lessonId) {
    const { error } = await supabase.rpc("admin_reset_ai_course_media", {
      p_course_id: courseId,
      p_lesson_id: lessonId,
      p_media_status: "draft",
    });

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("courses")
    .update({
      ai_media_status: "draft",
      ai_publish_status: "not_ready",
      media_approved_at: null,
      media_approved_by: null,
    })
    .eq("id", courseId)
    .eq("ai_generated", true);

  if (error) throw error;
}

async function approveMediaScopeIfReady(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
  lessonId: string | null,
  actorUserId: string,
) {
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const assets = await getCourseMediaAssets(supabase, courseId);

  if (lessonId) {
    const lesson = workflow.lessons.find((item) => item.id === lessonId);
    if (!lesson) {
      throw new Error("Lesson not found.");
    }

    const lessonAssets = assets.filter((asset) => asset.lesson_id === lessonId);
    const requiredLessonAssets = lessonAssets.filter(isRequiredMediaAsset);
    const validation = validateMediaApproval(lessonAssets);
    const lessonReady =
      lesson.ai_text_status === "approved"
      && requiredLessonAssets.length > 0
      && validation.missingRequiredAssets.length === 0
      && validation.failedRequiredAssets.length === 0
      && requiredLessonAssets.every((asset) => asset.review_status === "approved");

    if (lessonReady) {
      const approvedAt = new Date().toISOString();
      const { error } = await supabase
        .from("lessons")
        .update({
          ai_media_status: "approved",
          ai_publish_status: "ready",
          media_approved_at: lesson.media_approved_at ?? approvedAt,
          media_approved_by: lesson.media_approved_by ?? actorUserId,
        })
        .eq("id", lessonId);

      if (error) throw error;
    }
  }

  return recomputeCourseAiStatuses(supabase, courseId, actorUserId);
}

export async function generateLearningMediaAsset(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const assetId = sanitizePlainTextInput(String(formData.get("assetId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120) || null;
  const redirectTo = getRedirectTarget(formData, lessonId ? `/admin/courses/lessons/${lessonId}` : `/admin/courses/${courseId}`);
  const mediaConfig = getAiMediaConfig();

  if (!mediaConfig.canGenerate) {
    redirect(
      appendAdminNotice(
        redirectTo,
        `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
      ),
    );
  }

  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, lessons, pages } = workflow;
  ensureAiCourse(course);

  const asset = await getLearningMediaAssetById(supabase, assetId);
  if (asset.course_id !== courseId) {
    throw new Error("This media asset does not belong to this course.");
  }

  if (!isImageMediaAsset(asset)) {
    throw new Error("This media slot is not an image-based media type yet.");
  }

  if (isGenerationExcludedMediaAsset(asset)) {
    throw new Error("This optional media slot is excluded from generation.");
  }

  const lesson = asset.lesson_id
    ? lessons.find((item) => item.id === asset.lesson_id) ?? null
    : null;

  if (asset.lesson_id) {
    if (!lesson) {
      throw new Error("Media asset lesson not found.");
    }
    ensureAiLesson(lesson);
    if (lesson.ai_text_status !== "approved") {
      throw new Error("Approve this lesson's text before generating this media.");
    }
  } else if (course.ai_text_status !== "approved") {
    throw new Error("Approve the course text before generating this media.");
  }

  const target = resolveMediaTarget(asset, buildPagesByLessonId(pages), new Set<string>());
  if (!target) {
    throw new Error("This media slot does not have a supported target.");
  }

  const jobId = await enqueueMediaAssetsJob(
    supabase,
    profile.id,
    {
      actorUserId: profile.id,
      assetId,
      courseId,
      mode: "single_media_asset",
    },
    courseId,
  );

  revalidatePath(lessonId ? `/admin/courses/lessons/${lessonId}` : `/admin/courses/${courseId}`);
  redirect(
    appendAdminNotice(
      redirectTo,
      `Media generation queued. Job ${jobId} will generate this media slot when the worker runs.`,
    ),
  );
}

export async function approveLearningMediaAsset(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const assetId = sanitizePlainTextInput(String(formData.get("assetId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120) || null;
  const redirectTo = getRedirectTarget(formData, lessonId ? `/admin/courses/lessons/${lessonId}` : `/admin/courses/${courseId}`);
  const asset = await getLearningMediaAssetById(supabase, assetId);

  if (asset.course_id !== courseId) {
    throw new Error("This media asset does not belong to this course.");
  }

  if (!assetHasUsablePreview(asset) || asset.generation_status === "failed") {
    throw new Error("Add or generate a media preview before approval.");
  }

  const { error } = await supabase
    .from("learning_media_assets")
    .update({ review_status: "approved", generation_error: null })
    .eq("id", assetId);

  if (error) throw error;

  const updatedAsset = await getLearningMediaAssetById(supabase, assetId);
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const target = resolveMediaTarget(updatedAsset, buildPagesByLessonId(workflow.pages), new Set<string>());
  if (target) {
    await applyAssetTarget(supabase, updatedAsset, target);
  }

  const aggregate = await approveMediaScopeIfReady(supabase, courseId, asset.lesson_id, profile.id);

  await insertAuditEvent(supabase, profile.id, "learning_media_asset_approved", "media_asset", assetId, {
    courseId,
    lessonId: asset.lesson_id,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  revalidateLearningPaths(courseId, asset.lesson_id ? [asset.lesson_id] : []);
  redirect(appendAdminNotice(redirectTo, "Media approved."));
}

export async function useLibraryMediaAsset(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const assetId = sanitizePlainTextInput(String(formData.get("assetId") ?? ""), 120);
  const libraryAssetId = sanitizePlainTextInput(String(formData.get("libraryAssetId") ?? ""), 120);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120) || null;
  const redirectTo = getRedirectTarget(formData, lessonId ? `/admin/courses/lessons/${lessonId}` : `/admin/courses/${courseId}`);

  if (!libraryAssetId) {
    throw new Error("Choose a library media asset first.");
  }

  const [targetAsset, libraryAsset] = await Promise.all([
    getLearningMediaAssetById(supabase, assetId),
    getLearningMediaAssetById(supabase, libraryAssetId),
  ]);

  if (targetAsset.course_id !== courseId || libraryAsset.course_id !== courseId) {
    throw new Error("Library media must belong to this course.");
  }

  if (!assetHasUsablePreview(libraryAsset)) {
    throw new Error("The selected library media does not have a usable preview.");
  }

  if (!isImageMediaAsset(libraryAsset)) {
    throw new Error("Only image media can be reused from the library.");
  }

  const metadata = asRecord(targetAsset.metadata);
  const { error } = await supabase
    .from("learning_media_assets")
    .update({
      url: libraryAsset.url,
      storage_path: libraryAsset.storage_path,
      source: "library",
      provider: libraryAsset.provider,
      model: libraryAsset.model,
      alt_text: libraryAsset.alt_text || targetAsset.alt_text,
      caption: libraryAsset.caption || targetAsset.caption,
      review_status: "draft",
      generation_status: "completed",
      generation_error: null,
      metadata: {
        ...metadata,
        previousUrl: targetAsset.url,
        librarySourceAssetId: libraryAsset.id,
        librarySourcePlacement: libraryAsset.placement,
        librarySelectedAt: new Date().toISOString(),
        librarySelectedBy: profile.id,
      },
    })
    .eq("id", assetId);

  if (error) throw error;

  const updatedAsset = await getLearningMediaAssetById(supabase, assetId);
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const target = resolveMediaTarget(updatedAsset, buildPagesByLessonId(workflow.pages), new Set<string>());
  if (target) {
    await applyAssetTarget(supabase, updatedAsset, target);
  }

  await resetMediaApprovalAfterAssetChange(supabase, courseId, targetAsset.lesson_id);
  await recomputeCourseAiStatuses(supabase, courseId, profile.id);

  await insertAuditEvent(supabase, profile.id, "learning_media_asset_library_selected", "media_asset", assetId, {
    courseId,
    lessonId: targetAsset.lesson_id,
    libraryAssetId,
  });

  revalidateLearningPaths(courseId, targetAsset.lesson_id ? [targetAsset.lesson_id] : []);
  redirect(appendAdminNotice(redirectTo, "Library media applied."));
}

export async function requestLessonMediaChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const lessonId = sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/lessons/${lessonId}`);
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, lessons } = workflow;
  const feedback = parseRequiredChangeRequest(formData, "mediaChangeRequest");
  ensureAiCourse(course);
  ensureAiLesson(lesson);
  const nextNotes = appendMediaRevisionFeedback(asRecord(lesson.ai_generation_notes), {
    kind: "request",
    feedback,
    requestedAt: new Date().toISOString(),
    requestedBy: profile.id,
  });

  const { error: assetsError } = await supabase
    .from("learning_media_assets")
    .update({ review_status: "changes_requested" })
    .eq("course_id", course.id)
    .eq("lesson_id", lessonId);

  if (assetsError) throw assetsError;

  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_media_status: "changes_requested",
      ai_publish_status: "not_ready",
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: nextNotes,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, profile.id);

  await insertAuditEvent(supabase, profile.id, "ai_lesson_media_changes_requested", "lesson", lessonId, {
    courseId: course.id,
    feedback,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  revalidateLearningPaths(course.id, lessons.map((item) => item.id));
  redirect(appendAdminNotice(redirectTo, "Lesson media changes requested. Publishing has been locked again."));
}

function normalizeLegacyAssetType(
  asset: Pick<WorkflowMediaAssetRow, "asset_type" | "placement" | "lesson_id" | "metadata" | "prompt" | "script">,
) {
  if (isImageMediaAsset(asset as Pick<WorkflowMediaAssetRow, "asset_type">)) {
    return asset.asset_type;
  }

  const metadata = asRecord(asset.metadata);
  const targetKind = getMetadataString(metadata, "targetKind");
  const placement = asset.placement.toLowerCase();
  const prompt = sanitizePlainTextInput(String(asset.prompt ?? ""), 500).toLowerCase();
  const script = sanitizePlainTextInput(String(asset.script ?? ""), 500).toLowerCase();
  const combined = `${placement} ${prompt} ${script}`;

  if (targetKind === "course_cover" || placement === "course_cover") {
    return "cover";
  }

  if (
    targetKind === "course_thumbnail"
    || targetKind === "lesson_thumbnail"
    || placement.includes("thumbnail")
  ) {
    return "thumbnail";
  }

  if (combined.includes("infographic") || combined.includes("diagram") || combined.includes("visual summary")) {
    return "infographic";
  }

  return "image";
}

export async function normalizeCourseLegacyMediaAssets(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const regenerateNormalized = parseBooleanFlag(formData.get("regenerateNormalized"));
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, lessons } = workflow;

  ensureAiCourse(course);

  const assets = await getCourseMediaAssets(supabase, courseId);
  const legacyAssets = assets.filter((asset) => !isImageMediaAsset(asset));

  if (legacyAssets.length === 0) {
    redirect(appendAdminNotice(redirectTo, "No legacy unsupported media briefs were found for this course."));
  }

  for (const asset of legacyAssets) {
    const nextAssetType = normalizeLegacyAssetType(asset);
    const nextMetadata = {
      ...asRecord(asset.metadata),
      normalizedFromAssetType: asset.asset_type,
      normalizedAt: new Date().toISOString(),
      normalizedBy: profile.id,
      previousUrl: asset.url,
    };

    const { error } = await supabase
      .from("learning_media_assets")
      .update({
        asset_type: nextAssetType,
        url: null,
        storage_path: null,
        provider: null,
        model: null,
        review_status: "draft",
        generation_status: "pending",
        generation_error: null,
        metadata: nextMetadata,
      })
      .eq("id", asset.id);

    if (error) throw error;
  }

  const { error: resetError } = await supabase.rpc("admin_reset_ai_course_media", {
    p_course_id: courseId,
    p_lesson_id: null,
    p_media_status: "draft",
  });

  if (resetError) throw resetError;

  await recomputeCourseAiStatuses(supabase, courseId, profile.id);

  await insertAuditEvent(supabase, profile.id, "ai_course_legacy_media_normalized", "course", courseId, {
    normalizedAssetCount: legacyAssets.length,
    regenerateNormalized,
  });

  if (regenerateNormalized) {
    const nextFormData = new FormData();
    nextFormData.set("courseId", courseId);
    nextFormData.set("redirectTo", redirectTo);
    return generateCourseMediaAssets(nextFormData);
  }

  revalidateLearningPaths(courseId, lessons.map((lesson) => lesson.id));
  redirect(
    appendAdminNotice(
      redirectTo,
      `${legacyAssets.length} legacy media brief${legacyAssets.length === 1 ? "" : "s"} converted to supported visual types.`,
    ),
  );
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
  const nextAssetType = sanitizePlainTextInput(String(formData.get("assetType") ?? "image"), 40);
  const requestedPageMediaTarget = sanitizePlainTextInput(String(formData.get("pageMediaTarget") ?? ""), 40);
  const nextUrl = sanitizeUrlInput(String(formData.get("url") ?? ""), 1000) || null;
  const presentation = parseImagePresentationInput(formData);
  const excludeFromGeneration = parseBooleanFlag(formData.get("excludeFromGeneration"));
  const { data: existingAsset, error: assetError } = await supabase
    .from("learning_media_assets")
    .select("url, metadata, asset_type, placement, lesson_id, course_id")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) throw assetError;

  const typedExistingAsset = existingAsset as Pick<WorkflowMediaAssetRow, "url" | "metadata" | "asset_type" | "placement" | "lesson_id" | "course_id"> | null;
  const existingMetadata = asRecord(typedExistingAsset?.metadata);
  const targetPageId = getMetadataString(existingMetadata, "targetPageId");
  const nextTargetKind =
    nextAssetType === "infographic" && targetPageId
      ? "page_block"
      : requestedPageMediaTarget === "page_block" && targetPageId
        ? "page_block"
        : requestedPageMediaTarget === "page_cover" && targetPageId
          ? "page_cover"
          : getMetadataString(existingMetadata, "targetKind");

  const nextMetadata = {
    ...existingMetadata,
    previousUrl: typedExistingAsset?.url ?? null,
    manuallyEditedAt: new Date().toISOString(),
    excludeFromGeneration,
    fit: presentation.fit,
    positionX: presentation.positionX,
    positionY: presentation.positionY,
    ...(nextTargetKind ? { targetKind: nextTargetKind } : {}),
    ...(nextAssetType === "infographic" || nextTargetKind === "page_block"
      ? { preferredPlacement: "page_block" }
      : {}),
    ...(nextAssetType === "infographic"
      ? { mediaNote: "Infographics are intended for in-page teaching use, not page cover art." }
      : {}),
  };

  const { error } = await supabase
    .from("learning_media_assets")
    .update({
      asset_type: nextAssetType,
      placement: sanitizePlainTextInput(String(formData.get("placement") ?? ""), 180),
      prompt: sanitizePlainTextInput(String(formData.get("prompt") ?? ""), 2000),
      script: sanitizePlainTextInput(String(formData.get("script") ?? ""), 4000),
      url: nextUrl,
      alt_text: sanitizePlainTextInput(String(formData.get("altText") ?? ""), 240),
      caption: sanitizePlainTextInput(String(formData.get("caption") ?? ""), 500),
      review_status: sanitizePlainTextInput(String(formData.get("reviewStatus") ?? "draft"), 40),
      generation_status: nextUrl ? "completed" : "pending",
      generation_error: null,
      metadata: nextMetadata,
    })
    .eq("id", assetId);

  if (error) throw error;

  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, pages } = workflow;
  const { data: updatedAsset, error: updatedAssetError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("id", assetId)
    .maybeSingle();

  if (updatedAssetError) throw updatedAssetError;

  const typedUpdatedAsset = updatedAsset as WorkflowMediaAssetRow | null;

  if (typedUpdatedAsset) {
    const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>();
    for (const page of pages) {
      const current = pagesByLessonId.get(page.lesson_id) ?? [];
      current.push(page);
      pagesByLessonId.set(page.lesson_id, current);
    }

    const previousTarget = typedExistingAsset
      ? resolveMediaTarget(
          {
            id: assetId,
            course_id: typedExistingAsset.course_id,
            lesson_id: typedExistingAsset.lesson_id,
            asset_type: typedExistingAsset.asset_type,
            placement: typedExistingAsset.placement,
            source: "ai_generated",
            prompt: null,
            script: null,
            url: typedExistingAsset.url,
            storage_path: null,
            provider: null,
            model: null,
            alt_text: null,
            caption: null,
            metadata: typedExistingAsset.metadata ?? {},
            review_status: "draft",
            generation_status: "pending",
            generation_error: null,
            sort_order: 0,
          },
          pagesByLessonId,
          new Set<string>(),
        )
      : null;
    const target = resolveMediaTarget(typedUpdatedAsset, pagesByLessonId, new Set<string>());
    if (previousTarget && typedExistingAsset && (!target || previousTarget.key !== target.key)) {
      await clearAssetTarget(
        supabase,
        {
          id: assetId,
          course_id: typedExistingAsset.course_id,
          lesson_id: typedExistingAsset.lesson_id,
          asset_type: typedExistingAsset.asset_type,
          placement: typedExistingAsset.placement,
          source: "ai_generated",
          prompt: null,
          script: null,
          url: typedExistingAsset.url,
          storage_path: null,
          provider: null,
          model: null,
          alt_text: null,
          caption: null,
          metadata: typedExistingAsset.metadata ?? {},
          review_status: "draft",
          generation_status: "pending",
          generation_error: null,
          sort_order: 0,
        },
        previousTarget,
      );
    }
    if (target) {
      if (excludeFromGeneration || !typedUpdatedAsset.url) {
        await clearAssetTarget(supabase, typedUpdatedAsset, target);
      } else {
        await applyAssetTarget(supabase, typedUpdatedAsset, target);
      }
    }
  }

  const targetLesson = lessonId
    ? workflow.lessons.find((item) => item.id === lessonId) ?? null
    : null;

  if (course.ai_media_status === "approved" || targetLesson?.ai_media_status === "approved") {
    const { error: resetError } = await supabase.rpc("admin_reset_ai_course_media", {
      p_course_id: courseId,
      p_lesson_id: lessonId || null,
      p_media_status: "draft",
    });

    if (resetError) throw resetError;

    await recomputeCourseAiStatuses(supabase, courseId, profile.id);
  }

  await insertAuditEvent(supabase, profile.id, "learning_media_asset_updated", "media_asset", assetId, {
    courseId,
    lessonId: lessonId || null,
  });

  revalidateLearningPaths(courseId, lessonId ? [lessonId] : []);
  redirect(appendAdminNotice(redirectTo, "Media asset saved."));
}
