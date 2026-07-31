import assert from "node:assert/strict";
import test from "node:test";
import {
  getMediaJobMode,
  getPromptBoolean,
  getPromptInput,
  getPromptNumber,
  getPromptString,
} from "../../features/ai-generation/application/job-prompts.ts";

test("prompt primitive helpers preserve strict JSON prompt typing", () => {
  const prompt = {
    enabled: true,
    count: 2.6,
    empty: "",
    numericText: "12",
    title: "  Course title  ",
  };

  assert.equal(getPromptString(prompt, "title"), "  Course title  ");
  assert.equal(getPromptString(prompt, "count"), "");
  assert.equal(getPromptNumber(prompt, "count", 4), 2.6);
  assert.equal(getPromptNumber(prompt, "numericText", 4), 4);
  assert.equal(getPromptBoolean(prompt, "enabled"), true);
  assert.equal(getPromptBoolean({ enabled: "true" }, "enabled"), false);
});

test("media job mode prefers explicit valid modes and falls back from prompt ids", () => {
  assert.equal(getMediaJobMode({ mode: "lesson_media", assetId: "asset-1" }), "lesson_media");
  assert.equal(getMediaJobMode({ mode: "unknown", assetId: "asset-1" }), "single_media_asset");
  assert.equal(getMediaJobMode({ lessonId: "lesson-1", courseId: "course-1" }), "lesson_media");
  assert.equal(getMediaJobMode({ courseId: "course-1" }), "course_media");
  assert.equal(getMediaJobMode({}), "");
});

test("prompt input normalizes generation fields without importing server-only generator code", () => {
  const input = getPromptInput({
    audience: " New earners <> ",
    difficulty: "advanced",
    lessonCount: 99,
    notes: " Keep examples local <> ",
    questionsPerLesson: 2,
    region: " Nigeria ",
    tone: " Practical ",
    topic: " Budgeting basics <> ",
  });

  assert.deepEqual(input, {
    audience: "New earners",
    difficulty: "advanced",
    lessonCount: 8,
    notes: "Keep examples local",
    questionsPerLesson: 7,
    region: "Nigeria",
    tone: "Practical",
    topic: "Budgeting basics",
  });
});

test("prompt input defaults unsupported difficulty and missing numeric values", () => {
  assert.deepEqual(
    getPromptInput({
      difficulty: "expert",
      lessonCount: Number.NaN,
      questionsPerLesson: "10",
      topic: "Saving",
    }),
    {
      audience: "",
      difficulty: "beginner",
      lessonCount: 4,
      notes: "",
      questionsPerLesson: 7,
      region: "",
      tone: "",
      topic: "Saving",
    },
  );
});
