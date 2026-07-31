import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpansionContinuityInstruction,
  buildPlannedLessonsContinuityInstruction,
  buildSelectedCourseNotes,
  buildUrl,
  clampInteger,
  getRecommendedQuestionCount,
  mergeNewCourseOptionEdits,
  slugify,
  summarizeBlock,
} from "../../features/learning/admin/planner-domain.ts";
import {
  normalizeCourseExpansionContext,
  parseStoredCourseExpansionPlan,
  parseStoredNewCoursePlan,
  parseStoredNewCoursePlanSelection,
} from "../../features/learning/admin/planner-model.ts";

function option(overrides = {}) {
  return {
    title: "Money Basics",
    description: "Learn practical money habits.",
    courseGoal: "Help learners handle everyday money choices.",
    targetAudience: "Secondary school learners",
    level: "beginner",
    tone: "simple and practical",
    learningObjectives: ["Track spending", "Compare needs and wants"],
    lessonOutline: [
      {
        title: "Track Your Spending",
        purpose: "Show where money goes.",
        learningObjective: "Learners can write a simple spending list.",
      },
      {
        title: "Needs Before Wants",
        purpose: "Prioritize important spending.",
        learningObjective: "Learners can sort needs and wants.",
      },
    ],
    quizStrategy: "Use short scenario questions.",
    mediaStyle: "Simple illustrated examples.",
    whyThisCourse: "It helps learners make safer daily choices.",
    ...overrides,
  };
}

function expansionSuggestion(overrides = {}) {
  return {
    title: "Practice Budget Choices",
    reason: "Learners need a practice lesson after the basics.",
    placement: "After Needs Before Wants",
    learningObjective: "Learners can choose between two budget options.",
    difficulty: "intermediate",
    estimatedMinutes: 20,
    suggestedPages: [
      {
        title: "Two Budget Choices",
        pageType: "scenario",
        purpose: "Compare two choices.",
      },
    ],
    quizApproach: "Ask which option is safer and why.",
    mediaSuggestions: [
      {
        assetType: "image",
        placement: "lesson cover",
        prompt: "A simple market budgeting scene",
        altText: "Learner comparing two spending choices",
        caption: "Compare before you spend.",
      },
    ],
    ...overrides,
  };
}

test("planner primitive helpers stay importable without server-only dependencies", () => {
  assert.equal(slugify("  Money & Safety! "), "money-safety");
  assert.equal(clampInteger(12.6, 1, 10), 10);
  assert.equal(getRecommendedQuestionCount("advanced"), 9);
  assert.equal(getRecommendedQuestionCount("intermediate"), 8);
  assert.equal(getRecommendedQuestionCount("beginner"), 7);
  assert.equal(buildUrl("/admin/courses", { notice: "saved", empty: "" }), "/admin/courses?notice=saved");
});

test("planner note builders preserve selected brief and expansion context", () => {
  const input = {
    roughIdea: "Money decisions",
    audience: "Students",
    region: "Nigeria",
    level: "beginner",
    tone: "plain",
    notes: "Use familiar examples.",
  };
  const selected = option();

  assert.match(buildSelectedCourseNotes(input, selected), /Selected brief title: Money Basics/);
  assert.match(buildSelectedCourseNotes(input, selected), /Track Your Spending - Show where money goes/);
  assert.match(buildPlannedLessonsContinuityInstruction(selected), /Create exactly 2 new lessons/);
  assert.match(
    buildExpansionContinuityInstruction("Money Basics", expansionSuggestion(), "Keep it practical."),
    /Create exactly one new lesson/,
  );
});

test("planner option edit merge sanitizes JSON-backed editable fields", () => {
  const formData = new FormData();
  formData.set("selectedTitle", "Updated Money Basics");
  formData.set("selectedLevel", "advanced");
  formData.set("learningObjectivesJson", JSON.stringify([" Save first ", "<bad>"]));
  formData.set("lessonOutlineJson", JSON.stringify([
    {
      title: "Updated Lesson",
      purpose: "Practice saving safely.",
      learningObjective: "Learners can name one saving rule.",
    },
  ]));

  const merged = mergeNewCourseOptionEdits(formData, option());

  assert.equal(merged.title, "Updated Money Basics");
  assert.equal(merged.level, "advanced");
  assert.deepEqual(merged.learningObjectives, ["Save first", "bad"]);
  assert.deepEqual(merged.lessonOutline, [
    {
      title: "Updated Lesson",
      purpose: "Practice saving safely.",
      learningObjective: "Learners can name one saving rule.",
    },
  ]);
});

test("stored planner parsers normalize valid records and reject invalid ones", () => {
  const stored = parseStoredNewCoursePlan({
    input: {
      roughIdea: " Money choices ",
      audience: " Students ",
      region: " Nigeria ",
      level: "unexpected",
      tone: " Practical ",
      notes: " Keep local ",
    },
    result: {
      options: [option(), option({ title: "Saving Habits" }), option({ title: "Budget Practice" })],
    },
  });

  assert.equal(stored?.input.level, "beginner");
  assert.equal(stored?.input.roughIdea, "Money choices");
  assert.equal(stored?.result.options.length, 3);
  assert.equal(parseStoredNewCoursePlan({ result: { options: [] } }), null);

  const selection = parseStoredNewCoursePlanSelection({
    ...option(),
    generatedCourseId: "course-1",
    lessonsGeneratedCount: 200,
  });
  assert.equal(selection?.generatedCourseId, "course-1");
  assert.equal(selection?.lessonsGeneratedCount, 50);
});

test("course expansion normalization clamps context and parser output", () => {
  const context = normalizeCourseExpansionContext({
    courseId: "course-1",
    courseTitle: "Money Basics",
    courseDescription: "A practical course.",
    courseCategory: "Life skills",
    courseLevel: "advanced",
    existingLessons: [
      {
        title: "Lesson",
        description: "Description",
        pages: [{ title: "Page", pageType: "unknown", summary: "Summary" }],
        quizSummary: "Quiz",
      },
    ],
    expansionGoal: "Fill topic gaps",
    numberOfSuggestions: 99,
    notes: "More practice",
  });

  assert.equal(context.numberOfSuggestions, 6);
  assert.equal(context.existingLessons[0].pages[0].pageType, "unknown");

  const parsed = parseStoredCourseExpansionPlan({
    input: context,
    result: {
      courseAnalysis: {
        currentCoverage: ["Basics"],
        gaps: ["Practice"],
        recommendedDirection: "Add a scenario lesson.",
      },
      lessonSuggestions: [expansionSuggestion(), expansionSuggestion({ title: "Another Lesson" })],
    },
  });

  assert.equal(parsed?.result.lessonSuggestions.length, 2);
  assert.equal(parsed?.result.lessonSuggestions[0].difficulty, "intermediate");
});

test("block summaries prefer meaningful text payload fields", () => {
  assert.equal(
    summarizeBlock({
      page_id: "page-1",
      block_type: "text",
      sort_order: 1,
      payload: {
        heading: "Main idea",
        body: "Learners compare needs and wants.",
        transcript: "<ignore tags>",
      },
    }),
    "Main idea Learners compare needs and wants. ignore tags",
  );
});
