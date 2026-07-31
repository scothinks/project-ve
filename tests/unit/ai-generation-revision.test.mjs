import assert from "node:assert/strict";
import test from "node:test";
import {
  appendMediaRevisionFeedback,
  appendTextRevisionFeedback,
  buildCourseExtensionContext,
  buildCourseRevisionNotes,
  getGeneratedFromInput,
  getLatestMediaRevisionFeedback,
  getLatestTextRevisionFeedback,
  getRecommendedQuestionCountForRevision,
} from "../../features/ai-generation/domain/revision.ts";

function course(overrides = {}) {
  return {
    id: "course-1",
    title: "Money Basics",
    description: "Learn practical money skills.",
    category: "Finance",
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
    title: "Budgeting",
    description: "Plan weekly spending.",
    sort_order: 1,
    ai_generated: true,
    ai_text_status: "approved",
    ai_media_status: "generation_ready",
    ai_publish_status: "not_ready",
    ai_generation_notes: {},
    ...overrides,
  };
}

test("generated-from input uses stored prompt metadata with safe defaults", () => {
  assert.deepEqual(
    getGeneratedFromInput(course({
      ai_generation_notes: {
        generatedFrom: {
          audience: " Young adults ",
          difficulty: "advanced",
          region: "Nigeria",
          tone: "Practical",
          topic: "Budgeting <>",
        },
      },
    })),
    {
      audience: " Young adults ",
      difficulty: "advanced",
      region: "Nigeria",
      tone: "Practical",
      topic: "Budgeting ",
    },
  );

  assert.deepEqual(
    getGeneratedFromInput(course({ title: "Fallback Topic", level: "intermediate" })),
    {
      audience: "Current course learners",
      difficulty: "intermediate",
      region: "Current course region",
      tone: "clear and practical",
      topic: "Fallback Topic",
    },
  );
});

test("revision feedback history returns latest request and keeps bounded history", () => {
  const notes = {
    textRevisionFeedbackHistory: [
      { kind: "request", feedback: "First", requestedAt: "t1", requestedBy: "u1" },
      { kind: "applied", feedback: "Done" },
      { kind: "request", feedback: "Second", requestedAt: "t2", requestedBy: "u2" },
    ],
    mediaRevisionFeedbackHistory: [
      { kind: "request", feedback: "Need brighter media", requestedAt: "m1", requestedBy: "u1" },
    ],
  };

  assert.deepEqual(getLatestTextRevisionFeedback(notes), {
    feedback: "Second",
    requestedAt: "t2",
    requestedBy: "u2",
  });
  assert.deepEqual(getLatestMediaRevisionFeedback(notes), {
    feedback: "Need brighter media",
    requestedAt: "m1",
    requestedBy: "u1",
  });

  const fullHistoryNotes = {
    textRevisionFeedbackHistory: Array.from({ length: 12 }, (_, index) => ({
      kind: "request",
      feedback: `Item ${index}`,
    })),
  };
  const nextNotes = appendTextRevisionFeedback(fullHistoryNotes, { kind: "applied", feedback: "Done" });
  assert.equal(nextNotes.textRevisionFeedbackHistory.length, 10);
  assert.equal(nextNotes.textRevisionFeedbackHistory[0].feedback, "Item 3");

  const mediaNotes = appendMediaRevisionFeedback({}, { kind: "request", feedback: "Media change" });
  assert.deepEqual(mediaNotes.mediaRevisionFeedbackHistory, [
    { kind: "request", feedback: "Media change" },
  ]);
});

test("revision helpers build extension context and recommended question counts", () => {
  assert.deepEqual(
    buildCourseExtensionContext(course(), [lesson()], ""),
    {
      course: {
        id: "course-1",
        title: "Money Basics",
        description: "Learn practical money skills.",
        category: "Finance",
        level: "beginner",
      },
      lessons: [
        {
          title: "Budgeting",
          description: "Plan weekly spending.",
        },
      ],
      continuityInstruction: undefined,
    },
  );

  assert.equal(getRecommendedQuestionCountForRevision("beginner"), 7);
  assert.equal(getRecommendedQuestionCountForRevision("intermediate"), 8);
  assert.equal(getRecommendedQuestionCountForRevision("advanced"), 9);
});

test("course revision notes include course, page, block, quiz, and feedback context", () => {
  const notes = buildCourseRevisionNotes({
    course: course(),
    lessons: [lesson()],
    pages: [
      {
        id: "page-1",
        lesson_id: "lesson-1",
        page_number: 1,
        title: "Plan income",
        subtitle: "Start with money in",
        page_type: "concept",
      },
    ],
    blocks: [
      {
        page_id: "page-1",
        block_type: "text",
        sort_order: 1,
        payload: {
          heading: "Income first",
          body: "Write your income before spending.",
        },
      },
    ],
    quizzes: [
      {
        id: "quiz-1",
        lesson_id: "lesson-1",
        title: "Budget quiz",
        ai_generated: true,
        ai_text_status: "draft",
        status: "draft",
      },
    ],
    questions: [
      {
        quiz_id: "quiz-1",
        question_order: 1,
        prompt: "What comes first?",
        explanation: "Income comes first.",
        xp: 10,
      },
    ],
    feedback: "Make it clearer.",
  });

  assert.match(notes, /Current course title: Money Basics/);
  assert.match(notes, /Editor requested changes: Make it clearer\./);
  assert.match(notes, /- Page 1: Plan income \(concept\) Start with money in Income first Write your income before spending\./);
  assert.match(notes, /Quiz title: Budget quiz/);
  assert.match(notes, /- Q1: What comes first\? \[xp 10\]/);
});
