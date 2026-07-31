import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImagePayloadFromAsset,
  createCourseLevelMediaSeedRows,
  createCourseMediaSeedRows,
  createLessonMediaSeedRows,
  resolveMediaTarget,
} from "../../features/ai-generation/domain/media-planning.ts";

function course(overrides = {}) {
  return {
    id: "course-1",
    title: "Money Basics",
    description: "Learn practical money skills.",
    category: "Finance",
    level: "beginner",
    status: "draft",
    ai_generated: true,
    ai_text_status: "draft",
    ai_media_status: "not_started",
    ai_publish_status: "not_ready",
    ai_generation_notes: {},
    ...overrides,
  };
}

function lesson(overrides = {}) {
  return {
    id: "lesson-1",
    course_id: "course-1",
    title: "Budgeting",
    description: "Plan weekly spending.",
    sort_order: 1,
    ai_generated: true,
    ai_text_status: "approved",
    ai_media_status: "generation_ready",
    ai_publish_status: "not_ready",
    ai_generation_notes: {},
    ...overrides,
  };
}

function page(overrides = {}) {
  return {
    id: "page-1",
    lesson_id: "lesson-1",
    page_number: 1,
    title: "Budget plan",
    subtitle: "Use income first",
    page_type: "concept",
    ...overrides,
  };
}

function asset(overrides = {}) {
  return {
    id: "asset-1",
    course_id: "course-1",
    lesson_id: null,
    asset_type: "thumbnail",
    placement: "course_thumbnail",
    source: "ai_generated",
    prompt: null,
    script: null,
    url: null,
    storage_path: null,
    provider: null,
    model: null,
    alt_text: null,
    caption: null,
    metadata: {},
    review_status: "draft",
    generation_status: "pending",
    generation_error: null,
    sort_order: 0,
    ...overrides,
  };
}

test("course media seed rows create course, lesson, and page visual placeholders", () => {
  const rows = createCourseMediaSeedRows(
    course(),
    [lesson()],
    [
      page({ id: "page-concept", page_number: 1, page_type: "concept" }),
      page({ id: "page-summary", page_number: 2, page_type: "summary" }),
    ],
    [],
    "job-1",
  );

  assert.deepEqual(
    rows.map((row) => row.placement),
    [
      "course_cover",
      "course_thumbnail",
      "lesson_thumbnail",
      "page_1_image",
      "page_2_infographic",
    ],
  );
  assert.equal(rows[1].metadata.required, true);
  assert.equal(rows[3].metadata.targetKind, "page_cover");
  assert.equal(rows[4].metadata.targetKind, "page_block");
  assert.equal(rows[4].metadata.targetPageId, "page-summary");
});

test("course-level media seed rows create cover and required thumbnail from a starting sort order", () => {
  const rows = createCourseLevelMediaSeedRows(course(), "job-1", 5);

  assert.deepEqual(
    rows.map((row) => ({
      assetType: row.asset_type,
      placement: row.placement,
      required: row.metadata.required,
      sortOrder: row.sort_order,
      targetKind: row.metadata.targetKind,
    })),
    [
      {
        assetType: "cover",
        placement: "course_cover",
        required: false,
        sortOrder: 5,
        targetKind: "course_cover",
      },
      {
        assetType: "thumbnail",
        placement: "course_thumbnail",
        required: true,
        sortOrder: 6,
        targetKind: "course_thumbnail",
      },
    ],
  );
  assert.equal(rows[0].prompt.includes("Money Basics"), true);
  assert.equal(rows[1].caption, "Money Basics");
});


test("media seed rows do not duplicate existing assets for the same target", () => {
  const rows = createLessonMediaSeedRows(
    course(),
    lesson(),
    [page({ id: "page-concept", page_number: 1, page_type: "concept" })],
    [
      asset({
        id: "existing-thumbnail",
        lesson_id: "lesson-1",
        asset_type: "thumbnail",
        placement: "lesson_thumbnail",
      }),
      asset({
        id: "existing-image",
        lesson_id: "lesson-1",
        asset_type: "image",
        placement: "page_1_image",
      }),
    ],
    "job-1",
  );

  assert.deepEqual(rows.map((row) => row.placement), []);
});

test("media target resolution respects metadata and placement fallbacks", () => {
  const pagesByLessonId = new Map([
    [
      "lesson-1",
      [
        page({ id: "page-1", page_number: 1, page_type: "concept" }),
        page({ id: "page-2", page_number: 2, page_type: "summary" }),
      ],
    ],
  ]);

  assert.deepEqual(
    resolveMediaTarget(
      asset({
        id: "asset-block",
        lesson_id: "lesson-1",
        asset_type: "infographic",
        metadata: {
          targetKind: "asset_only",
          preferredPlacement: "page_block",
          targetPageId: "page-2",
        },
      }),
      pagesByLessonId,
      new Set(),
    ),
    { kind: "page_block", key: "page-block:page-2:asset-block", pageId: "page-2" },
  );

  assert.deepEqual(
    resolveMediaTarget(
      asset({
        id: "asset-page",
        lesson_id: "lesson-1",
        asset_type: "image",
        placement: "page_2_image",
      }),
      pagesByLessonId,
      new Set(),
    ),
    { kind: "page_cover", key: "page-cover:page-2", pageId: "page-2" },
  );
});

test("image payload uses media metadata presentation with safe fallbacks", () => {
  assert.deepEqual(
    buildImagePayloadFromAsset(
      asset({
        url: "https://example.com/image.png",
        alt_text: "",
        caption: "Budget image",
        metadata: {
          fit: "contain",
          positionX: 25,
          positionY: 75,
        },
      }),
    ),
    {
      src: "https://example.com/image.png",
      alt: "Budget image",
      fit: "contain",
      positionX: 25,
      positionY: 75,
    },
  );
});
