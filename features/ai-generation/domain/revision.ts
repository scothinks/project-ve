import { sanitizePlainTextInput } from "../../../lib/input-safety.ts";
import type {
  AiCourseExtensionContext,
  AiCourseGenerationInput,
  AiGeneratorLevel,
} from "../../../lib/ai-learning-generator.ts";
import type {
  WorkflowCourseRow,
  WorkflowLessonBlockRow,
  WorkflowLessonPageRow,
  WorkflowLessonRow,
  WorkflowQuizQuestionRow,
  WorkflowQuizRow,
} from "../data/workflow.ts";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getGeneratedFromInput(
  course: Pick<WorkflowCourseRow, "ai_generation_notes" | "level" | "title">,
) {
  const notes = asRecord(course.ai_generation_notes);
  const generatedFrom = asRecord(notes.generatedFrom);
  return {
    audience: sanitizePlainTextInput(String(generatedFrom.audience ?? "Current course learners"), 160) || "Current course learners",
    region: sanitizePlainTextInput(String(generatedFrom.region ?? "Current course region"), 120) || "Current course region",
    tone: sanitizePlainTextInput(String(generatedFrom.tone ?? "clear and practical"), 120) || "clear and practical",
    difficulty:
      String(generatedFrom.difficulty ?? course.level) === "advanced"
        ? "advanced"
        : String(generatedFrom.difficulty ?? course.level) === "intermediate"
          ? "intermediate"
          : "beginner",
    topic: sanitizePlainTextInput(String(generatedFrom.topic ?? course.title), 160) || course.title,
  } satisfies Pick<AiCourseGenerationInput, "audience" | "region" | "tone" | "difficulty" | "topic">;
}

function getLatestRevisionFeedback(notes: Record<string, unknown>, historyKey: string) {
  const history = Array.isArray(notes[historyKey])
    ? notes[historyKey]
    : [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = asRecord(history[index]);
    const kind = sanitizePlainTextInput(String(entry.kind ?? ""), 40);
    const feedback = sanitizePlainTextInput(String(entry.feedback ?? ""), 3000).trim();
    if (kind === "request" && feedback) {
      return {
        feedback,
        requestedAt: sanitizePlainTextInput(String(entry.requestedAt ?? ""), 80),
        requestedBy: sanitizePlainTextInput(String(entry.requestedBy ?? ""), 80),
      };
    }
  }

  return null;
}

function appendRevisionFeedback(
  notes: Record<string, unknown>,
  historyKey: string,
  entry: Record<string, unknown>,
): Record<string, unknown> {
  const history = Array.isArray(notes[historyKey])
    ? notes[historyKey].slice(-9)
    : [];

  return {
    ...notes,
    [historyKey]: [...history, entry],
  };
}

export function getLatestTextRevisionFeedback(notes: Record<string, unknown>) {
  return getLatestRevisionFeedback(notes, "textRevisionFeedbackHistory");
}

export function appendTextRevisionFeedback(
  notes: Record<string, unknown>,
  entry: Record<string, unknown>,
) {
  return appendRevisionFeedback(notes, "textRevisionFeedbackHistory", entry);
}

export function getLatestMediaRevisionFeedback(notes: Record<string, unknown>) {
  return getLatestRevisionFeedback(notes, "mediaRevisionFeedbackHistory");
}

export function appendMediaRevisionFeedback(
  notes: Record<string, unknown>,
  entry: Record<string, unknown>,
) {
  return appendRevisionFeedback(notes, "mediaRevisionFeedbackHistory", entry);
}

function summarizeBlockForRevision(block: WorkflowLessonBlockRow) {
  const payload = asRecord(block.payload);
  const candidates = [
    payload.heading,
    payload.title,
    payload.body,
    payload.caption,
    payload.transcript,
    payload.alt,
  ];

  return candidates
    .map((value) => sanitizePlainTextInput(String(value ?? ""), 180).trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
}

export function getRecommendedQuestionCountForRevision(level: AiGeneratorLevel) {
  if (level === "advanced") return 9;
  if (level === "intermediate") return 8;
  return 7;
}

export function buildCourseRevisionNotes({
  course,
  lessons,
  pages,
  blocks,
  quizzes,
  questions,
  feedback,
}: {
  course: WorkflowCourseRow;
  lessons: WorkflowLessonRow[];
  pages: WorkflowLessonPageRow[];
  blocks: WorkflowLessonBlockRow[];
  quizzes: WorkflowQuizRow[];
  questions: WorkflowQuizQuestionRow[];
  feedback: string;
}) {
  const pagesByLessonId = new Map<string, WorkflowLessonPageRow[]>();
  for (const page of pages) {
    const current = pagesByLessonId.get(page.lesson_id) ?? [];
    current.push(page);
    pagesByLessonId.set(page.lesson_id, current);
  }

  const blocksByPageId = new Map<string, WorkflowLessonBlockRow[]>();
  for (const block of blocks) {
    const current = blocksByPageId.get(block.page_id) ?? [];
    current.push(block);
    blocksByPageId.set(block.page_id, current);
  }

  const quizByLessonId = new Map<string, WorkflowQuizRow>();
  for (const quiz of quizzes) {
    quizByLessonId.set(quiz.lesson_id, quiz);
  }

  const questionsByQuizId = new Map<string, WorkflowQuizQuestionRow[]>();
  for (const question of questions) {
    const current = questionsByQuizId.get(question.quiz_id) ?? [];
    current.push(question);
    questionsByQuizId.set(question.quiz_id, current);
  }

  const lessonSummaries = lessons.map((lesson, lessonIndex) => {
    const lessonPages = pagesByLessonId.get(lesson.id) ?? [];
    const quiz = quizByLessonId.get(lesson.id);
    const quizQuestions = quiz ? questionsByQuizId.get(quiz.id) ?? [] : [];
    const pageLines = lessonPages.map((page) => {
      const blockSummary = (blocksByPageId.get(page.id) ?? [])
        .slice(0, 3)
        .map(summarizeBlockForRevision)
        .filter(Boolean)
        .join(" ");
      return `- Page ${page.page_number}: ${page.title} (${page.page_type}) ${page.subtitle ?? ""} ${blockSummary}`.trim();
    });
    const quizLines = quizQuestions
      .slice(0, 7)
      .map((question) => `- Q${question.question_order}: ${question.prompt} [xp ${question.xp}]`);

    return [
      `${lessonIndex + 1}. ${lesson.title}`,
      `Lesson description: ${lesson.description ?? "No description."}`,
      "Pages:",
      ...pageLines,
      `Quiz title: ${quiz?.title ?? "No quiz."}`,
      ...quizLines,
    ].join("\n");
  });

  return [
    `Current course title: ${course.title}`,
    `Current course description: ${course.description}`,
    `Current course category: ${course.category}`,
    `Current course level: ${course.level}`,
    `Editor requested changes: ${feedback}`,
    "Revise the existing course draft instead of creating a different course.",
    "Address the requested changes directly and improve the weak areas named by the editor.",
    "Keep the course coherent, practical, safe, and suitable for semi-literate to secondary-school learners.",
    "Keep or improve the overall course structure while making the revisions meaningful.",
    "Current lesson/page/quiz structure:",
    ...lessonSummaries,
  ].join("\n\n");
}

export function buildCourseExtensionContext(
  course: WorkflowCourseRow,
  lessons: WorkflowLessonRow[],
  continuityInstruction: string,
): AiCourseExtensionContext {
  return {
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
    },
    lessons: lessons.map((lesson) => ({
      title: lesson.title,
      description: lesson.description ?? "",
    })),
    continuityInstruction: continuityInstruction || undefined,
  };
}
