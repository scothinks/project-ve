import assert from "node:assert/strict";
import test from "node:test";
import { parseAiGenerationInput } from "../../features/ai-generation/application/generation-form.ts";

function formData(entries = []) {
  const form = new FormData();
  for (const [key, value] of entries) {
    form.set(key, value);
  }
  return form;
}

test("generation form parser returns canonical AI generation input", () => {
  const input = parseAiGenerationInput(formData([
    ["topic", "  Digital citizenship <> "],
    ["audience", "SS2 learners"],
    ["region", "Nigeria"],
    ["difficulty", "advanced"],
    ["tone", "Practical"],
    ["lessonCount", "6"],
    ["questionsPerLesson", "5"],
    ["notes", " Focus on classroom examples <> "],
  ]));

  assert.deepEqual(input, {
    topic: "Digital citizenship",
    audience: "SS2 learners",
    region: "Nigeria",
    difficulty: "advanced",
    tone: "Practical",
    lessonCount: 6,
    questionsPerLesson: 5,
    notes: "Focus on classroom examples",
  });
});

test("generation form parser raises structured validation errors", () => {
  assert.throws(
    () => parseAiGenerationInput(formData([
      ["difficulty", "expert"],
      ["lessonCount", "NaN"],
    ])),
    /Invalid AI course form data/,
  );
});
