import assert from "node:assert/strict";
import test from "node:test";
import {
  getAssessmentIssues,
  getAssessmentXp,
  getCorrectOptionCount,
} from "../../features/learning/admin/assessment-builder-domain.ts";
import {
  buildCourseReadiness,
  getCourseEditorialLifecycle,
} from "../../features/learning/admin/course-readiness.ts";
import { mapMediaAssetToPickerValue } from "../../components/admin/media-picker-domain.ts";
import {
  insertBlockAtPosition,
  reorderBlocksById,
  reorderPagesById,
} from "../../features/learning/admin/lesson-page-builder-domain.ts";
import {
  buildSelectedPlanSelection,
  getRecommendedQuestionCount,
  mergeNewCourseOptionEdits,
} from "../../features/learning/admin/planner-domain.ts";

const iso = "2026-08-01T00:00:00.000Z";

function course(overrides = {}) {
  return {
    id: "course-1",
    slug: "course-1",
    title: "Safety Course",
    description: "A practical safety course.",
    category: "Values Education",
    level: "beginner",
    status: "draft",
    estimated_minutes: 20,
    sort_order: 1,
    thumbnail: {
      src: "https://example.test/thumb.png",
      alt: "Learners practicing safety",
    },
    ai_generated: false,
    ai_text_status: "approved",
    ai_media_status: "approved",
    ai_publish_status: "ready",
    created_at: iso,
    updated_at: iso,
    ...overrides,
  };
}

function lesson(overrides = {}) {
  return {
    id: "lesson-1",
    course_id: "course-1",
    slug: "lesson-1",
    title: "Lesson 1",
    subtitle: null,
    description: "A complete lesson.",
    status: "published",
    cover_image: null,
    sort_order: 1,
    estimated_minutes: 10,
    retry_mode: "anytime",
    retry_cooldown_seconds: null,
    retry_requires_reread: true,
    quiz_requires_lesson_completion: true,
    max_earning_attempts: null,
    ai_generated: false,
    ai_text_status: "approved",
    ai_media_status: "approved",
    ai_publish_status: "ready",
    created_at: iso,
    updated_at: iso,
    ...overrides,
  };
}

function page(overrides = {}) {
  return {
    id: "page-1",
    lesson_id: "lesson-1",
    page_number: 1,
    title: "Page 1",
    subtitle: null,
    page_type: "concept",
    cover_image: null,
    created_at: iso,
    updated_at: iso,
    ...overrides,
  };
}

function block(overrides = {}) {
  return {
    id: "block-1",
    page_id: "page-1",
    block_type: "text",
    sort_order: 1,
    payload: { body: "Complete content." },
    ...overrides,
  };
}

function quiz(overrides = {}) {
  return {
    id: "quiz-1",
    lesson_id: "lesson-1",
    title: "Quiz",
    status: "published",
    ai_generated: false,
    ai_text_status: "approved",
    created_at: iso,
    updated_at: iso,
    ...overrides,
  };
}

function question(overrides = {}) {
  return {
    id: "question-1",
    quiz_id: "quiz-1",
    question_order: 1,
    question_type: "single_choice",
    prompt: "What keeps the workflow safe?",
    explanation: "Editors use the supported workflow.",
    xp: 5,
    options: [
      {
        id: "option-1",
        question_id: "question-1",
        option_order: 1,
        label: "Use the supported workflow",
        is_correct: true,
      },
      {
        id: "option-2",
        question_id: "question-1",
        option_order: 2,
        label: "Bypass review",
        is_correct: false,
      },
    ],
    ...overrides,
  };
}

function mediaAsset(overrides = {}) {
  return {
    id: "asset-1",
    course_id: "course-1",
    lesson_id: null,
    asset_type: "cover",
    placement: "course_cover",
    prompt: "Course cover",
    alt_text: "Course cover alt",
    caption: "Course cover caption",
    url: "https://example.test/cover.png",
    provider: null,
    model: null,
    generation_status: "completed",
    generation_error: null,
    review_status: "approved",
    metadata: { targetKind: "course_cover", fit: "contain", positionX: 30, positionY: 70 },
    created_at: iso,
    updated_at: iso,
    ...overrides,
  };
}

test("course readiness aggregates blockers, warnings, lifecycle, and publish gates", () => {
  const ready = buildCourseReadiness({
    blocks: [block()],
    course: course(),
    includeLifecycleApproval: true,
    lessons: [lesson()],
    mediaAssets: [mediaAsset()],
    pages: [page()],
    questions: [question()],
    quizzes: [quiz()],
  });

  assert.equal(ready.lifecycle, "approved");
  assert.equal(ready.canPublish, true);
  assert.equal(ready.blockers.map((item) => item.id).includes("editorial-lifecycle"), false);
  assert.deepEqual(ready.warnings.map((item) => item.id), ["lesson-count"]);

  const incomplete = buildCourseReadiness({
    blocks: [block({ block_type: "image", payload: { src: "https://example.test/image.png", alt: "" } })],
    course: course({ description: "", thumbnail: { src: "https://example.test/thumb.png", alt: "" } }),
    includeLifecycleApproval: false,
    lessons: [lesson({ status: "draft" })],
    mediaAssets: [
      mediaAsset({ alt_text: "", metadata: { required: true, targetKind: "lesson_image" }, placement: "lesson body" }),
    ],
    pages: [page()],
    questions: [question({ options: [] })],
    quizzes: [quiz()],
  });

  assert.equal(incomplete.canApprove, false);
  assert.deepEqual(
    incomplete.blockers.map((item) => item.id),
    ["course-overview", "assessments", "media-alt"],
  );
  assert.equal(getCourseEditorialLifecycle(course({ ai_text_status: "changes_requested" })), "changes_requested");
});

test("quiz validation blocks invalid publish states and totals XP", () => {
  const singleChoice = question({
    options: [
      { id: "option-1", question_id: "question-1", option_order: 1, label: "A", is_correct: true },
      { id: "option-2", question_id: "question-1", option_order: 2, label: "B", is_correct: true },
    ],
  });

  assert.equal(getCorrectOptionCount(singleChoice), 2);
  assert.deepEqual(
    getAssessmentIssues([singleChoice]).map((issue) => issue.message),
    ["Single-choice questions must have exactly one correct answer."],
  );
  assert.deepEqual(
    getAssessmentIssues([]).map((issue) => issue.message),
    ["Add at least one question before publishing."],
  );
  assert.equal(getAssessmentXp([question({ xp: 7 }), question({ id: "question-2", xp: 9 })]), 16);
});

test("lesson builder domain covers drag ordering and insert-position behavior", () => {
  assert.deepEqual(
    reorderPagesById(
      [
        page({ id: "page-1", page_number: 1 }),
        page({ id: "page-2", page_number: 2 }),
        page({ id: "page-3", page_number: 3 }),
      ],
      "page-3",
      "page-1",
    ).map((item) => [item.id, item.page_number]),
    [
      ["page-1", 2],
      ["page-2", 3],
      ["page-3", 1],
    ],
  );

  assert.deepEqual(
    reorderBlocksById(
      [
        block({ id: "block-1", sort_order: 1 }),
        block({ id: "block-2", sort_order: 2 }),
        block({ id: "block-3", page_id: "page-2", sort_order: 1 }),
      ],
      "block-2",
      "block-1",
    ).map((item) => [item.id, item.sort_order]),
    [
      ["block-1", 2],
      ["block-2", 1],
      ["block-3", 1],
    ],
  );

  assert.deepEqual(
    insertBlockAtPosition(
      [
        block({ id: "block-1", sort_order: 1 }),
        block({ id: "block-2", sort_order: 2 }),
      ],
      "page-1",
      block({ id: "draft-block", isDraft: true }),
      1,
    ).map((item) => [item.id, item.sort_order]),
    [
      ["block-1", 1],
      ["draft-block", 2],
      ["block-2", 3],
    ],
  );
});

test("media picker maps library asset values into editable presentation state", () => {
  assert.deepEqual(
    mapMediaAssetToPickerValue(
      mediaAsset({
        alt_text: "Selected alt",
        caption: "Selected caption",
        metadata: { fit: "contain", positionX: "25", positionY: 90 },
        url: "https://example.test/selected.png",
      }),
      { fit: "cover", positionX: 50, positionY: 50 },
    ),
    {
      altText: "Selected alt",
      caption: "Selected caption",
      fit: "contain",
      positionX: 25,
      positionY: 90,
      url: "https://example.test/selected.png",
    },
  );

  assert.deepEqual(
    mapMediaAssetToPickerValue(
      mediaAsset({ alt_text: null, caption: null, metadata: { fit: "bad", positionX: 200 }, url: null }),
      { fit: "cover", positionX: 40, positionY: 60 },
    ),
    {
      altText: "",
      caption: "",
      fit: "cover",
      positionX: 100,
      positionY: 60,
      url: "",
    },
  );
});

test("AI-assisted planner transformations stay deterministic without live model calls", () => {
  const option = {
    title: "Safety Basics",
    description: "Learn basic safety choices.",
    courseGoal: "Help learners choose safer actions.",
    targetAudience: "Teen learners",
    level: "beginner",
    tone: "plain",
    learningObjectives: ["Spot risky choices"],
    lessonOutline: [
      {
        title: "Risk or safe",
        purpose: "Classify choices.",
        learningObjective: "Learners classify everyday choices.",
      },
    ],
    quizStrategy: "Scenario checks.",
    mediaStyle: "Realistic classroom scenes.",
    whyThisCourse: "It helps learners practice safe decisions.",
  };
  const formData = new FormData();
  formData.set("selectedLevel", "advanced");
  formData.set("learningObjectivesJson", JSON.stringify([" Identify pressure ", "Choose a safer response"]));

  const merged = mergeNewCourseOptionEdits(formData, option);

  assert.equal(getRecommendedQuestionCount(merged.level), 9);
  assert.deepEqual(merged.learningObjectives, ["Identify pressure", "Choose a safer response"]);
  assert.deepEqual(buildSelectedPlanSelection(merged, { generatedCourseId: "course-1" }).generatedCourseId, "course-1");
});
