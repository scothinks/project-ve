import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAiGenerationInputForm,
  parseCourseExpansionPlanForm,
  parseNewCoursePlanInputForm,
} from "../../lib/admin-ai-validation.ts";

function formData(entries) {
  const form = new FormData();

  for (const [key, value] of entries) {
    form.set(key, value);
  }

  return form;
}

function hasIssue(result, path, message) {
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.path === path && issue.message === message),
    `Expected ${path}: ${message}`,
  );
}

test("AI course generation form requires core prompt fields and bounded counts", () => {
  const result = parseAiGenerationInputForm(formData([
    ["topic", ""],
    ["audience", "Learners"],
    ["region", ""],
    ["tone", ""],
    ["difficulty", "expert"],
    ["lessonCount", "12"],
    ["questionsPerLesson", "1"],
  ]));

  hasIssue(result, "difficulty", "Expected one of: beginner, intermediate, advanced.");
  hasIssue(result, "lessonCount", "Must be at most 8.");
  hasIssue(result, "questionsPerLesson", "Must be at least 3.");
  hasIssue(result, "region", "Required.");
  hasIssue(result, "tone", "Required.");
  hasIssue(result, "topic", "Required.");
});

test("AI course generation form returns canonical model input", () => {
  const result = parseAiGenerationInputForm(formData([
    ["topic", "  Budgeting basics  "],
    ["audience", "  Young adults  "],
    ["region", "  Nigeria  "],
    ["tone", "  practical  "],
    ["difficulty", "intermediate"],
    ["lessonCount", "5"],
    ["questionsPerLesson", "8"],
    ["notes", " Keep examples local. "],
  ]));

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    audience: "Young adults",
    difficulty: "intermediate",
    lessonCount: 5,
    notes: "Keep examples local.",
    questionsPerLesson: 8,
    region: "Nigeria",
    tone: "practical",
    topic: "Budgeting basics",
  });
});

test("new course planner form requires operator prompt context", () => {
  const result = parseNewCoursePlanInputForm(formData([
    ["roughIdea", ""],
    ["audience", ""],
    ["region", ""],
    ["level", "expert"],
    ["tone", ""],
  ]));

  hasIssue(result, "audience", "Required.");
  hasIssue(result, "level", "Expected one of: beginner, intermediate, advanced.");
  hasIssue(result, "region", "Required.");
  hasIssue(result, "roughIdea", "Required.");
  hasIssue(result, "tone", "Required.");
});

test("course expansion planner form validates goal and suggestion count", () => {
  const result = parseCourseExpansionPlanForm(formData([
    ["course_id", "course-1"],
    ["expansion_goal", "Make it viral"],
    ["number_of_suggestions", "9"],
  ]));

  hasIssue(
    result,
    "expansion_goal",
    "Expected one of: Add beginner lessons, Add advanced lessons, Add scenario/practice lessons, Add recap/assessment lesson, Fill topic gaps, Improve weak course progression, Create follow-up course.",
  );
  hasIssue(result, "number_of_suggestions", "Must be at most 6.");
});
