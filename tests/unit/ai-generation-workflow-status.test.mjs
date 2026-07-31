import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCourseAiStatusPatch,
  deriveCourseMediaStatus,
  deriveCoursePublishStatus,
  deriveCourseTextStatus,
  ensureAiCourse,
  ensureAiLesson,
  getApprovedReviewStatus,
  isLessonMediaApprovalReady,
} from "../../features/ai-generation/domain/workflow-status.ts";

function course(overrides = {}) {
  return {
    id: "course-1",
    title: "Course",
    description: "Description",
    category: "Money",
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
    title: "Lesson",
    description: "Description",
    sort_order: 1,
    ai_generated: true,
    ai_text_status: "draft",
    ai_media_status: "not_started",
    ai_publish_status: "not_ready",
    ai_generation_notes: {},
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
    metadata: { required: true },
    review_status: "draft",
    generation_status: "pending",
    generation_error: null,
    sort_order: 0,
    ...overrides,
  };
}

test("AI workflow guards reject non-AI-generated records", () => {
  assert.throws(
    () => ensureAiCourse(course({ ai_generated: false })),
    /only applies to AI-generated courses/,
  );
  assert.throws(
    () => ensureAiLesson(lesson({ ai_generated: false })),
    /only applies to AI-generated lessons/,
  );
});

test("course text status derives from AI lesson text review state", () => {
  assert.equal(
    deriveCourseTextStatus(course({ ai_text_status: "manual" }), []),
    "manual",
  );
  assert.equal(
    deriveCourseTextStatus(course(), [
      lesson({ id: "lesson-1", ai_text_status: "approved" }),
      lesson({ id: "lesson-2", ai_text_status: "approved" }),
    ]),
    "approved",
  );
  assert.equal(
    deriveCourseTextStatus(course(), [
      lesson({ id: "lesson-1", ai_text_status: "approved" }),
      lesson({ id: "lesson-2", ai_text_status: "changes_requested" }),
    ]),
    "changes_requested",
  );
});

test("course media status requires approved AI lessons and approved required course assets", () => {
  assert.equal(
    deriveCourseMediaStatus(
      course(),
      [lesson({ ai_media_status: "approved" })],
      [asset({ url: "https://example.com/thumb.png", review_status: "approved" })],
    ),
    "approved",
  );
  assert.equal(
    deriveCourseMediaStatus(
      course(),
      [lesson({ ai_media_status: "approved" })],
      [asset()],
    ),
    "in_review",
  );
  assert.equal(
    deriveCourseMediaStatus(
      course(),
      [lesson({ ai_media_status: "generation_ready" })],
      [],
    ),
    "generation_ready",
  );
});

test("course publish status requires approved text, approved media, and ready lessons", () => {
  assert.equal(
    deriveCoursePublishStatus(
      course(),
      [lesson({ ai_publish_status: "ready" })],
      "approved",
      "approved",
    ),
    "ready",
  );
  assert.equal(
    deriveCoursePublishStatus(
      course({ status: "published" }),
      [lesson({ ai_publish_status: "published" })],
      "approved",
      "approved",
    ),
    "published",
  );
  assert.equal(
    deriveCoursePublishStatus(
      course(),
      [lesson({ ai_publish_status: "not_ready" })],
      "approved",
      "approved",
    ),
    "not_ready",
  );
});

test("media approval promotion only approves usable non-failed assets", () => {
  assert.equal(
    getApprovedReviewStatus(asset({ url: "https://example.com/thumb.png" })),
    "approved",
  );
  assert.equal(
    getApprovedReviewStatus(asset({ generation_status: "failed", review_status: "draft" })),
    "draft",
  );
});

test("course AI status patch stamps approval metadata only for approved scopes", () => {
  assert.deepEqual(
    buildCourseAiStatusPatch(
      course(),
      {
        textStatus: "approved",
        mediaStatus: "in_review",
        publishStatus: "not_ready",
      },
      "admin-1",
      "2026-07-30T12:00:00.000Z",
    ),
    {
      ai_text_status: "approved",
      ai_media_status: "in_review",
      ai_publish_status: "not_ready",
      text_approved_at: "2026-07-30T12:00:00.000Z",
      text_approved_by: "admin-1",
      media_approved_at: null,
      media_approved_by: null,
    },
  );

  assert.deepEqual(
    buildCourseAiStatusPatch(
      course({
        media_approved_at: "existing-media-time",
        media_approved_by: "existing-admin",
        text_approved_at: "existing-text-time",
        text_approved_by: "existing-text-admin",
      }),
      {
        textStatus: "approved",
        mediaStatus: "approved",
        publishStatus: "ready",
      },
      "admin-2",
      "2026-07-30T12:00:00.000Z",
    ),
    {
      ai_text_status: "approved",
      ai_media_status: "approved",
      ai_publish_status: "ready",
      text_approved_at: "existing-text-time",
      text_approved_by: "existing-text-admin",
      media_approved_at: "existing-media-time",
      media_approved_by: "existing-admin",
    },
  );
});

test("lesson media readiness requires approved text and approved required media previews", () => {
  assert.equal(
    isLessonMediaApprovalReady(
      lesson({ ai_text_status: "approved" }),
      [asset({ lesson_id: "lesson-1", url: "https://example.com/thumb.png", review_status: "approved" })],
    ),
    true,
  );
  assert.equal(
    isLessonMediaApprovalReady(
      lesson({ ai_text_status: "draft" }),
      [asset({ lesson_id: "lesson-1", url: "https://example.com/thumb.png", review_status: "approved" })],
    ),
    false,
  );
  assert.equal(
    isLessonMediaApprovalReady(
      lesson({ ai_text_status: "approved" }),
      [asset({ lesson_id: "lesson-1", url: null, review_status: "approved" })],
    ),
    false,
  );
});
