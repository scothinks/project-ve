import assert from "node:assert/strict";
import test from "node:test";
import { parseLessonValueChoices, lessonValueChoicesKey } from "../../features/learning/admin/lesson-values-domain.ts";

const choice = { dimensionId: "integrity", weight: 0.67, recommendedLevel: "intermediate", outcomeType: "reflection" };
test("lesson values retain existing emphasis and guidance without retaining extra fields", () => {
  assert.deepEqual(parseLessonValueChoices([{ ...choice, contentId: "another-lesson" }]), [choice]);
  assert.deepEqual(parseLessonValueChoices([]), []);
});
test("lesson values reject malformed, duplicate and out-of-range choices", () => {
  for (const input of [null, {}, [null], [choice, choice], [{ ...choice, weight: NaN }], [{ ...choice, weight: 2 }], [{ ...choice, weight: "0.8" }], [{ ...choice, dimensionId: "" }], [{ ...choice, recommendedLevel: "expert" }], [{ ...choice, outcomeType: "unknown" }]]) {
    assert.throws(() => parseLessonValueChoices(input));
  }
});
test("draft comparison ignores display order but notices edits and removals", () => {
  const other = { ...choice, dimensionId: "empathy" };
  assert.equal(lessonValueChoicesKey([choice, other]), lessonValueChoicesKey([other, choice]));
  assert.notEqual(lessonValueChoicesKey([choice]), lessonValueChoicesKey([{ ...choice, weight: 0.8 }]));
  assert.notEqual(lessonValueChoicesKey([choice]), lessonValueChoicesKey([]));
});
