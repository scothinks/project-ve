import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGeneratedLessonTreeRows,
  ensureNoDuplicateLessonTitles,
  mapAiBlockToDb,
  parsePageNumberFromPlacement,
  slugify,
} from "../../features/ai-generation/domain/generated-tree.ts";

function generatedLesson(overrides = {}) {
  return {
    title: "Starter Budget",
    description: "Learn a simple budget.",
    estimatedMinutes: 8,
    pages: [
      {
        title: "Plan the week",
        subtitle: "A simple setup",
        pageType: "scenario",
        blocks: [
          {
            blockType: "text",
            payload: {
              heading: "Weekly plan",
              body: "Write income first.",
            },
          },
        ],
      },
    ],
    quiz: {
      title: "Starter Budget Quiz",
      questions: [
        {
          prompt: "What should come first?",
          questionType: "single_choice",
          explanation: "Start with income.",
          xp: 10,
          options: [
            { label: "Income", isCorrect: true },
            { label: "Guessing", isCorrect: false },
          ],
        },
      ],
    },
    mediaBriefs: [
      {
        assetType: "infographic",
        placement: "page_1_infographic",
        prompt: "Show a simple weekly budget.",
        script: "",
        altText: "Budget infographic",
        caption: "Weekly budget",
      },
    ],
    ...overrides,
  };
}

test("generated tree helpers normalize text IDs and placement page numbers", () => {
  assert.equal(slugify("  Starter Budget <> Basics!  "), "starter-budget-basics");
  assert.equal(parsePageNumberFromPlacement("page_3_infographic"), 3);
  assert.equal(parsePageNumberFromPlacement("lesson_thumbnail"), null);
});

test("generated block mapper sanitizes unsupported media into learner-safe callouts", () => {
  assert.deepEqual(
    mapAiBlockToDb({
      blockType: "image",
      payload: {
        alt: "A chart <bad>",
        caption: "Budget chart",
      },
    }),
    {
      block_type: "callout",
      payload: {
        variant: "example",
        title: "Budget chart",
        body: "Budget chart",
      },
    },
  );
});

test("duplicate generated lesson titles fail before materializing rows", () => {
  assert.throws(
    () => ensureNoDuplicateLessonTitles(
      [generatedLesson()],
      [generatedLesson({ title: "Starter Budget" })],
    ),
    /duplicate lesson title/,
  );
  assert.throws(
    () => ensureNoDuplicateLessonTitles(
      [],
      [
        generatedLesson({ title: "Starter Budget" }),
        generatedLesson({ title: "Starter Budget!" }),
      ],
    ),
    /duplicate new lesson titles/,
  );
});

test("generated lesson tree creates draft lesson, quiz, page, content, option, and media rows", () => {
  const tree = buildGeneratedLessonTreeRows({
    courseId: "course-1",
    lessons: [generatedLesson()],
    jobId: "job-1",
    startingSortOrder: 2,
  });

  assert.equal(tree.lessonRows.length, 1);
  assert.equal(tree.pageRows.length, 1);
  assert.equal(tree.blockRows.length, 1);
  assert.equal(tree.quizRows.length, 1);
  assert.equal(tree.questionRows.length, 1);
  assert.equal(tree.optionRows.length, 2);
  assert.equal(tree.mediaRows.length, 1);
  assert.equal(tree.lessonRows[0].course_id, "course-1");
  assert.equal(tree.lessonRows[0].status, "draft");
  assert.equal(tree.lessonRows[0].sort_order, 2);
  assert.equal(tree.pageRows[0].page_type, "example");
  assert.equal(tree.mediaRows[0].metadata.targetKind, "page_block");
  assert.equal(tree.mediaRows[0].metadata.targetPageId, tree.pageRows[0].id);
  assert.equal(tree.quizRows[0].lesson_id, tree.lessonRows[0].id);
  assert.equal(tree.questionRows[0].quiz_id, tree.quizRows[0].id);
});
