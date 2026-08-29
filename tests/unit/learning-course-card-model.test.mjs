import assert from "node:assert/strict";
import test from "node:test";
import {
  toLearningCourseCards,
} from "../../features/learning/application/course-card-model.ts";
import {
  learningCourseCardSelections,
} from "../../features/learning/data/course-card-projections.ts";
import { courses } from "../../lib/lessons.ts";

function collectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }

  if (!value || typeof value !== "object") {
    return keys;
  }

  for (const [key, item] of Object.entries(value)) {
    keys.add(key);
    collectKeys(item, keys);
  }

  return keys;
}

test("course card model preserves navigation, progress, imagery, and XP metadata", () => {
  const [source] = courses;
  const [card] = toLearningCourseCards([source]);
  const expectedXp = source.lessons.reduce(
    (courseTotal, lesson) =>
      courseTotal + lesson.quiz.questions.reduce((lessonTotal, question) => lessonTotal + question.xp, 0),
    0,
  );

  assert.equal(card.id, source.id);
  assert.equal(card.thumbnail.src, source.thumbnail.src);
  assert.equal(card.xp, expectedXp);
  assert.deepEqual(
    card.lessons[0].pages,
    source.lessons[0].pages.map((page) => ({ id: page.id, order: page.order })),
  );
  assert.deepEqual(
    card.lessons[0].quiz.questionIds,
    source.lessons[0].quiz.questions.map((question) => question.id),
  );
});

test("course card model and database projections exclude rich lesson and answer payloads", () => {
  const keys = collectKeys(toLearningCourseCards(courses));

  for (const forbiddenKey of [
    "blocks",
    "correctOptionIds",
    "explanation",
    "learningOutcomes",
    "options",
    "prompt",
  ]) {
    assert.equal(keys.has(forbiddenKey), false, forbiddenKey);
  }

  const projections = Object.values(learningCourseCardSelections).join(", ");
  for (const forbiddenColumn of [
    "block_type",
    "is_correct",
    "label",
    "payload",
    "prompt",
  ]) {
    assert.equal(projections.includes(forbiddenColumn), false, forbiddenColumn);
  }
});
