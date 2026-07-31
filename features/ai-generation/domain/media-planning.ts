import { normalizeImageFit, normalizeImagePosition } from "../../../lib/image-presentation.ts";
import { parsePageNumberFromPlacement } from "./generated-tree.ts";
import type {
  WorkflowCourseRow,
  WorkflowLessonPageRow,
  WorkflowLessonRow,
  WorkflowMediaAssetRow,
} from "../data/workflow.ts";

export type MediaTarget =
  | { kind: "course_thumbnail" | "course_cover" | "asset_only"; key: string; pageId?: undefined }
  | { kind: "lesson_thumbnail"; key: string; pageId?: undefined }
  | { kind: "page_block"; key: string; pageId: string }
  | { kind: "page_cover"; key: string; pageId: string };

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

export function buildCourseCoverPrompt(course: Pick<WorkflowCourseRow, "title" | "description" | "category">) {
  return `Warm, modern educational illustration for the course "${course.title}" in ${course.category}. ${course.description}`;
}

export function buildCourseThumbnailPrompt(course: Pick<WorkflowCourseRow, "title" | "description" | "category">) {
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

function buildAssetKey(asset: Pick<WorkflowMediaAssetRow, "course_id" | "lesson_id" | "asset_type" | "placement">) {
  return `${asset.course_id ?? "course"}:${asset.lesson_id ?? "none"}:${asset.asset_type}:${asset.placement}`;
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

export function createCourseMediaSeedRows(
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

export function createCourseLevelMediaSeedRows(
  course: Pick<WorkflowCourseRow, "id" | "title" | "description" | "category">,
  jobId: string,
  startingSortOrder = 0,
) {
  return [
    {
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
      sort_order: startingSortOrder,
    },
    {
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
      sort_order: startingSortOrder + 1,
    },
  ];
}

export function createLessonMediaSeedRows(
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

export function resolveMediaTarget(
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

function getAssetPresentation(asset: Pick<WorkflowMediaAssetRow, "metadata">) {
  const metadata = asRecord(asset.metadata);
  return {
    fit: normalizeImageFit(String(metadata.fit ?? "cover")),
    positionX: normalizeImagePosition(metadata.positionX, 50),
    positionY: normalizeImagePosition(metadata.positionY, 50),
  };
}

export function buildImagePayloadFromAsset(asset: WorkflowMediaAssetRow) {
  const presentation = getAssetPresentation(asset);
  return {
    src: asset.url,
    alt: asset.alt_text || asset.caption || asset.placement,
    fit: presentation.fit,
    positionX: presentation.positionX,
    positionY: presentation.positionY,
  };
}
