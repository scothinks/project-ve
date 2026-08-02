import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSaveCourseForm,
  parseSaveLessonForm,
  parseSaveQuizQuestionForm,
} from "../../lib/admin-course-validation.ts";

function formData(entries) {
  const form = new FormData();

  for (const [key, value] of entries) {
    form.set(key, value);
  }

  return form;
}

test("course form requires a title and rejects unexpected status values", () => {
  const result = parseSaveCourseForm(formData([
    ["title", ""],
    ["status", "enabled"],
    ["sortOrder", "0"],
    ["estimatedMinutes", "10"],
  ]));

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.toSorted((first, second) => first.path.localeCompare(second.path)), [
    { path: "status", message: "Expected one of: draft, published, archived." },
    { path: "title", message: "Required." },
  ]);
});

test("course form normalizes custom category, URL, and numeric fields", () => {
  const result = parseSaveCourseForm(formData([
    ["courseId", " course-1 "],
    ["title", "  Civics Basics  "],
    ["description", "  Intro  "],
    ["category", "General"],
    ["categoryCustom", " Civic Education "],
    ["level", "intermediate"],
    ["status", "published"],
    ["thumbnailUrl", "https://example.test/course.png"],
    ["thumbnailAlt", " cover image "],
    ["sortOrder", "2"],
    ["estimatedMinutes", "30"],
  ]));

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    courseId: "course-1",
    category: "Civic Education",
    description: "Intro",
    estimatedMinutes: 30,
    intendedAudience: "",
    learningOutcomes: [],
    level: "intermediate",
    sortOrder: 2,
    status: "published",
    thumbnail: {
      src: "https://example.test/course.png",
      alt: "cover image",
    },
    title: "Civics Basics",
  });
});

test("lesson form validates required course, retry enum, and numeric ranges", () => {
  const result = parseSaveLessonForm(formData([
    ["courseId", ""],
    ["title", "Budgeting"],
    ["status", "draft"],
    ["sortOrder", "-1"],
    ["estimatedMinutes", "NaN"],
    ["retryMode", "whenever"],
    ["retryCooldownSeconds", "-5"],
    ["maxEarningAttempts", "0"],
  ]));

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.toSorted((first, second) => first.path.localeCompare(second.path)), [
    { path: "courseId", message: "Required." },
    { path: "estimatedMinutes", message: "Expected an integer." },
    { path: "maxEarningAttempts", message: "Must be at least 1." },
    { path: "retryCooldownSeconds", message: "Must be at least 0." },
    { path: "retryMode", message: "Expected one of: anytime, cooldown, disabled." },
    { path: "sortOrder", message: "Must be at least 0." },
  ]);
});

test("quiz question form rejects invalid question type, XP range, and missing correct answer", () => {
  const result = parseSaveQuizQuestionForm(formData([
    ["lessonId", "lesson-1"],
    ["quizId", "quiz-1"],
    ["prompt", "Pick one"],
    ["questionType", "free_text"],
    ["xp", "25"],
    ["questionOrder", "0"],
    ["option1", "One"],
    ["option2", "Two"],
  ]));

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.toSorted((first, second) => first.path.localeCompare(second.path)), [
    { path: "options", message: "Mark at least one correct answer." },
    { path: "questionOrder", message: "Must be at least 1." },
    { path: "questionType", message: "Expected one of: single_choice, multiple_choice, true_false." },
    { path: "xp", message: "Must be at most 20." },
  ]);
});

test("quiz question form returns validated canonical values for domain execution", () => {
  const result = parseSaveQuizQuestionForm(formData([
    ["lessonId", "lesson-1"],
    ["quizId", "quiz-1"],
    ["questionId", "question-1"],
    ["prompt", "  Pick one  "],
    ["questionType", "single_choice"],
    ["explanation", " Because. "],
    ["xp", "10"],
    ["questionOrder", "3"],
    ["option1", " Right "],
    ["correct1", "on"],
    ["option2", " Wrong "],
  ]));

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    explanation: "Because.",
    lessonId: "lesson-1",
    options: [
      { label: "Right", isCorrect: true },
      { label: "Wrong", isCorrect: false },
    ],
    prompt: "Pick one",
    questionId: "question-1",
    questionOrder: 3,
    questionType: "single_choice",
    quizId: "quiz-1",
    xp: 10,
  });
});
