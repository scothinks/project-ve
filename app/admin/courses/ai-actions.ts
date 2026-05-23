"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
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
  type LearningMediaAssetForGeneration,
  type LearningMediaGenerationContext,
} from "@/lib/ai-media-generator";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";

type WorkflowCourseRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: AiGeneratorLevel;
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
  description: string | null;
  sort_order: number;
  ai_generated: boolean;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
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
  | { kind: "page_cover"; key: string; pageId: string };

type WorkflowMediaValidation = {
  missingRequiredAssets: WorkflowMediaAssetRow[];
  failedAssets: WorkflowMediaAssetRow[];
  staleAssets: WorkflowMediaAssetRow[];
};

const IMAGE_ASSET_TYPES = new Set(["image", "thumbnail", "cover", "infographic"]);

function isImageAssetType(assetType: string) {
  return IMAGE_ASSET_TYPES.has(assetType);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function getMetadataBoolean(metadata: Record<string, unknown>, key: string) {
  return metadata[key] === true;
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

function buildInlinePrompt(
  lesson: Pick<WorkflowLessonRow, "title" | "description">,
  page: Pick<WorkflowLessonPageRow, "title" | "subtitle" | "page_type">,
) {
  return `Inline illustration for the lesson "${lesson.title}" and page "${page.title}" (${page.page_type}). ${page.subtitle ?? lesson.description ?? ""}`;
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
  mode: "create_course" | "extend_course" = "create_course",
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
    .select("id, title, description, category, level, status, ai_generated, ai_text_status, ai_media_status, ai_publish_status")
    .eq("id", courseId)
    .maybeSingle<WorkflowCourseRow>();

  if (courseError) throw courseError;
  if (!course) {
    throw new Error("Course not found.");
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, course_id, title, description, sort_order, ai_generated, ai_text_status, ai_media_status, ai_publish_status")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<WorkflowLessonRow[]>();

  if (lessonsError) throw lessonsError;

  const lessonIds = (lessons ?? []).map((lesson) => lesson.id);
  let quizzes: WorkflowQuizRow[] = [];
  let pages: WorkflowLessonPageRow[] = [];

  if (lessonIds.length > 0) {
    const [quizResult, pagesResult] = await Promise.all([
      supabase
        .from("quizzes")
        .select("id, lesson_id, title, ai_generated, ai_text_status, status")
        .in("lesson_id", lessonIds)
        .returns<WorkflowQuizRow[]>(),
      supabase
        .from("lesson_pages")
        .select("id, lesson_id, page_number, title, subtitle, page_type")
        .in("lesson_id", lessonIds)
        .order("page_number", { ascending: true })
        .returns<WorkflowLessonPageRow[]>(),
    ]);

    if (quizResult.error) throw quizResult.error;
    if (pagesResult.error) throw pagesResult.error;
    quizzes = quizResult.data ?? [];
    pages = pagesResult.data ?? [];
  }

  return { course, lessons: lessons ?? [], quizzes, pages };
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

function parseBooleanFlag(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function buildAssetKey(asset: Pick<WorkflowMediaAssetRow, "course_id" | "lesson_id" | "asset_type" | "placement">) {
  return `${asset.course_id ?? "course"}:${asset.lesson_id ?? "none"}:${asset.asset_type}:${asset.placement}`;
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
    rows.push(row);
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
        required: true,
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
      sort_order: sortOrderCursor,
    });

    const hasInlineAsset = existingAssets.some((asset) => (
      asset.lesson_id === lesson.id
      && (asset.asset_type === "image" || asset.asset_type === "infographic")
    ));

    if (hasInlineAsset) {
      continue;
    }

    const [firstPage] = pagesByLessonId.get(lesson.id) ?? [];
    if (!firstPage) {
      continue;
    }

    pushRow({
      course_id: course.id,
      lesson_id: lesson.id,
      asset_type: "image",
      placement: `page_${firstPage.page_number}_inline`,
      source: "ai_generated",
      prompt: buildInlinePrompt(lesson, firstPage),
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${firstPage.title} illustration`,
      caption: firstPage.title,
      metadata: {
        jobId,
        required: true,
        targetKind: "page_cover",
        targetPageId: firstPage.id,
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: sortOrderCursor,
    });
  }

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

  if (metadataTargetKind === "asset_only") {
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

  const imagePayload = {
    src: asset.url,
    alt: asset.alt_text || asset.caption || asset.placement,
  };

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
  }
}

function validateMediaApproval(assets: WorkflowMediaAssetRow[]) {
  const imageAssets = assets.filter((asset) => isImageAssetType(asset.asset_type));
  return {
    missingRequiredAssets:
      imageAssets.length === 0
        ? []
        : imageAssets.filter((asset) => !asset.url),
    failedAssets: imageAssets.filter((asset) => asset.generation_status === "failed"),
    staleAssets: imageAssets.filter((asset) => getMetadataBoolean(asRecord(asset.metadata), "stale")),
  } satisfies WorkflowMediaValidation;
}

function getContinuityInstruction(formData: FormData) {
  return sanitizePlainTextInput(String(formData.get("continuityInstruction") ?? ""), 1000);
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
        storage_path: null,
        provider: null,
        model: null,
        alt_text: mediaBrief.altText,
        caption: mediaBrief.caption,
        metadata: {
          jobId,
          lessonId,
          lessonTitle: lesson.title,
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

async function insertGeneratedLessonTree(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  rows: ReturnType<typeof buildGeneratedLessonTreeRows>,
) {
  const { lessonRows, pageRows, blockRows, quizRows, questionRows, optionRows, mediaRows } = rows;

  if (lessonRows.length > 0) {
    const { error } = await supabase.from("lessons").insert(lessonRows);
    if (error) throw error;
  }

  if (pageRows.length > 0) {
    const { error } = await supabase.from("lesson_pages").insert(pageRows);
    if (error) throw error;
  }

  if (blockRows.length > 0) {
    const { error } = await supabase.from("lesson_content_blocks").insert(blockRows);
    if (error) throw error;
  }

  if (quizRows.length > 0) {
    const { error } = await supabase.from("quizzes").insert(quizRows);
    if (error) throw error;
  }

  if (questionRows.length > 0) {
    const { error } = await supabase.from("quiz_questions").insert(questionRows);
    if (error) throw error;
  }

  if (optionRows.length > 0) {
    const { error } = await supabase.from("quiz_options").insert(optionRows);
    if (error) throw error;
  }

  if (mediaRows.length > 0) {
    const { error } = await supabase.from("learning_media_assets").insert(mediaRows);
    if (error) throw error;
  }
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
    jobId = await createJob(supabase, profile.id, "course_text", {
      mode: "create_course",
      ...input,
    });
    const draft = await generateAiCourseDraftFromModel(input);
    const courseSlugBase = slugify(draft.course.title);
    const courseSlug = `${courseSlugBase}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
    courseId = createTextId("course", courseSlug);
    const generatedTree = buildGeneratedLessonTreeRows({
      courseId,
      lessons: draft.lessons,
      jobId,
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
      ai_generation_notes: buildCourseNotes(input, jobId, draft, "create_course"),
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
          jobId,
          required: true,
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
          jobId,
          required: true,
          targetKind: "course_thumbnail",
        },
        review_status: "draft",
        generation_status: "pending",
        generation_error: null,
        sort_order: generatedTree.mediaRows.length + 1,
      },
    );

    const { error: courseError } = await supabase.from("courses").insert(courseRow);
    if (courseError) throw courseError;
    await insertGeneratedLessonTree(supabase, generatedTree);

    await updateJob(supabase, jobId, {
      entity_id: courseId,
      status: "completed",
      result: {
        courseId,
        title: draft.course.title,
        lessonCount: draft.lessons.length,
        mediaAssetCount: generatedTree.mediaRows.length,
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

    revalidateLearningPaths(courseId, generatedTree.lessonIds);
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

  let jobId: string | null = null;
  let insertedLessonIds: string[] = [];

  try {
    const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
    const extensionContext = buildCourseExtensionContext(course, lessons, continuityInstruction);

    jobId = await createJob(supabase, profile.id, "course_text", {
      mode: "extend_course",
      courseId,
      continuityInstruction,
      ...input,
    });

    const draft = await generateAiLessonExtension(input, extensionContext);
    ensureNoDuplicateLessonTitles(lessons, draft.lessons);

    const nextSortOrder = lessons.reduce((max, lesson) => Math.max(max, lesson.sort_order), 0) + 1;
    const generatedTree = buildGeneratedLessonTreeRows({
      courseId,
      lessons: draft.lessons,
      jobId,
      startingSortOrder: nextSortOrder,
    });

    await insertGeneratedLessonTree(supabase, generatedTree);
    insertedLessonIds = generatedTree.lessonIds;

    const { error: courseUpdateError } = await supabase
      .from("courses")
      .update({
        ai_generated: true,
        ai_text_status: "draft",
        ai_media_status: "not_started",
        ai_publish_status: "not_ready",
        text_approved_at: null,
        text_approved_by: null,
        media_approved_at: null,
        media_approved_by: null,
        ai_generation_notes: {
          ...buildCourseNotes(input, jobId, draft, "extend_course"),
          extendedCourseId: courseId,
          addedLessonCount: draft.lessons.length,
          continuityInstruction: continuityInstruction || null,
        },
      })
      .eq("id", courseId);

    if (courseUpdateError) throw courseUpdateError;

    await updateJob(supabase, jobId, {
      entity_id: courseId,
      status: "completed",
      result: {
        mode: "extend_course",
        courseId,
        addedLessonCount: draft.lessons.length,
        lessonIds: generatedTree.lessonIds,
        mediaAssetCount: generatedTree.mediaRows.length,
      },
      error: null,
    });

    await insertAuditEvent(supabase, profile.id, "ai_course_extended_with_lessons", "course", courseId, {
      jobId,
      addedLessonCount: draft.lessons.length,
      lessonIds: generatedTree.lessonIds,
    });

    revalidateLearningPaths(courseId, generatedTree.lessonIds);
    redirect(
      appendAdminNotice(
        `/admin/courses/${courseId}`,
        `${draft.lessons.length} AI lesson${draft.lessons.length === 1 ? "" : "s"} added. Review the new text before media generation.`,
      ),
    );
  } catch (error) {
    if (insertedLessonIds.length > 0) {
      try {
        await supabase.from("lessons").delete().in("id", insertedLessonIds);
      } catch {
        // Ignore cleanup failures so the original extension error still surfaces.
      }
    }

    if (jobId) {
      await updateJob(supabase, jobId, {
        entity_id: courseId,
        status: "failed",
        error: error instanceof Error ? error.message : "Course extension failed.",
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

export async function generateCourseMediaAssets(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}`);
  const replaceExisting = parseBooleanFlag(formData.get("replaceExisting"));
  const { course, lessons, pages } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (course.ai_text_status !== "approved") {
    throw new Error("Approve the course text before generating media.");
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  const { data: existingAssets, error: assetsError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<WorkflowMediaAssetRow[]>();

  if (assetsError) throw assetsError;

  let jobId: string | null = null;
  try {
    jobId = await createJob(supabase, profile.id, "media_assets", {
      courseId,
      replaceExisting,
    });

    const seedRows = createCourseMediaSeedRows(course, lessons, pages, existingAssets ?? [], jobId);
    if (seedRows.length > 0) {
      const { error: insertError } = await supabase.from("learning_media_assets").insert(seedRows);
      if (insertError) throw insertError;
    }

    const { data: assets, error: refreshedAssetsError } = await supabase
      .from("learning_media_assets")
      .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<WorkflowMediaAssetRow[]>();

    if (refreshedAssetsError) throw refreshedAssetsError;

    const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>();
    for (const page of pages) {
      const current = pagesByLessonId.get(page.lesson_id) ?? [];
      current.push(page);
      pagesByLessonId.set(page.lesson_id, current);
    }

    const imageAssets = (assets ?? []).filter((asset) => isImageAssetType(asset.asset_type));
    const usedTargetKeys = new Set<string>();
    const usedPageIds = new Set<string>();
    let generatedCount = 0;
    let reusedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const asset of imageAssets) {
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
      const page = target.kind === "page_cover"
        ? pages.find((row) => row.id === target.pageId) ?? null
        : null;

      const context: LearningMediaGenerationContext = {
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
        targetKind: target.kind,
      };

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
            stale: false,
            targetKind: target.kind,
            targetPageId: target.kind === "page_cover" ? target.pageId : null,
          },
        };

        if (result.status === "skipped") {
          const { error: reusedAssetError } = await supabase
            .from("learning_media_assets")
            .update({
              generation_status: "completed",
              generation_error: null,
              metadata: updatedAsset.metadata,
            })
            .eq("id", asset.id);

          if (reusedAssetError) {
            throw reusedAssetError;
          }
        }

        await applyAssetTarget(supabase, updatedAsset, target);
        if (result.status === "generated") {
          generatedCount += 1;
        } else {
          reusedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        await updateAssetForSkip(
          supabase,
          asset.id,
          "failed",
          error instanceof Error ? error.message : "Image generation failed.",
        ).catch(() => undefined);
      }
    }

    const { error: mediaStatusError } = await supabase.rpc("admin_reset_ai_course_media", {
      p_course_id: courseId,
      p_lesson_id: null,
      p_media_status: "draft",
    });

    if (mediaStatusError) throw mediaStatusError;

    const jobStatus = generatedCount > 0 || reusedCount > 0 || skippedCount > 0
      ? "completed"
      : "failed";

    if (jobId) {
      await updateJob(supabase, jobId, {
        entity_id: courseId,
        status: jobStatus,
        result: {
          courseId,
          lessonCount: lessons.length,
          imageAssetCount: imageAssets.length,
          generatedCount,
          reusedCount,
          failedCount,
          skippedCount,
          replaceExisting,
        },
        error: jobStatus === "failed"
          ? "No media images were generated successfully."
          : null,
      });
    }

    await insertAuditEvent(supabase, profile.id, "ai_course_media_assets_generated", "course", courseId, {
      jobId,
      generatedCount,
      reusedCount,
      failedCount,
      skippedCount,
      replaceExisting,
    });

    revalidateLearningPaths(courseId, lessonIds);
    redirect(
      appendAdminNotice(
        redirectTo,
        `Media generation finished: ${generatedCount} new, ${reusedCount} reused, ${failedCount} failed, ${skippedCount} skipped.`,
      ),
    );
  } catch (error) {
    if (jobId) {
      await updateJob(supabase, jobId, {
        entity_id: courseId,
        status: "failed",
        error: error instanceof Error ? error.message : "Media generation failed.",
      }).catch(() => undefined);
    }

    throw error;
  }
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
    .eq("course_id", courseId)
    .returns<WorkflowMediaAssetRow[]>();

  if (assetQueryError) throw assetQueryError;

  const validation = validateMediaApproval(assets ?? []);
  const imageAssetCount = (assets ?? []).filter((asset) => isImageAssetType(asset.asset_type)).length;
  if (
    imageAssetCount === 0
    || 
    validation.missingRequiredAssets.length > 0
    || validation.failedAssets.length > 0
    || validation.staleAssets.length > 0
  ) {
    throw new Error(
      "Required image assets are still missing, stale, or failed. Regenerate media and confirm the previews before approval.",
    );
  }

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
  const nextUrl = sanitizeUrlInput(String(formData.get("url") ?? ""), 1000) || null;
  const { data: existingAsset, error: assetError } = await supabase
    .from("learning_media_assets")
    .select("url, metadata")
    .eq("id", assetId)
    .maybeSingle<{ url: string | null; metadata: Record<string, unknown> }>();

  if (assetError) throw assetError;

  const nextMetadata = {
    ...asRecord(existingAsset?.metadata),
    stale: false,
    staleAt: null,
    staleReason: null,
    previousUrl: existingAsset?.url ?? null,
    manuallyEditedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("learning_media_assets")
    .update({
      asset_type: sanitizePlainTextInput(String(formData.get("assetType") ?? "image"), 40),
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
    .maybeSingle<WorkflowMediaAssetRow>();

  if (updatedAssetError) throw updatedAssetError;

  if (updatedAsset?.url) {
    const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>();
    for (const page of pages) {
      const current = pagesByLessonId.get(page.lesson_id) ?? [];
      current.push(page);
      pagesByLessonId.set(page.lesson_id, current);
    }

    const target = resolveMediaTarget(updatedAsset, pagesByLessonId, new Set<string>());
    if (target) {
      await applyAssetTarget(supabase, updatedAsset, target);
    }
  }

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
