import {
  parseNewCoursePlanInputForm,
  type ValidatedNewCoursePlanInput,
} from "../../../lib/admin-ai-validation.ts";
import {
  parseStoredNewCoursePlan,
  parseStoredNewCoursePlanSelection,
  type CourseExpansionPlanResult,
  type CourseExpansionSuggestion,
  type NewCoursePlanInput,
  type NewCoursePlanOption,
  type PlannerLevel,
  type StoredNewCoursePlanSelection,
} from "./planner-model.ts";
import { logAppError, ValidationError } from "../../../lib/app-errors.ts";
import { formatValidationIssues } from "../../../lib/form-data-validation.ts";
import { sanitizePlainTextInput } from "../../../lib/input-safety.ts";
import type { ValidationResult } from "../../../lib/request-validation.ts";

export type PlannerCourseRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: PlannerLevel;
};

export type PlannerLessonRow = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

export type PlannerPageRow = {
  id: string;
  lesson_id: string;
  page_number: number;
  title: string;
  subtitle: string | null;
  page_type: string;
};

export type PlannerBlockRow = {
  page_id: string;
  block_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

export type PlannerQuizRow = {
  id: string;
  lesson_id: string;
  title: string;
};

export type PlannerQuestionRow = {
  quiz_id: string;
  question_order: number;
  prompt: string;
  explanation: string | null;
};

export type PlannerPlanRow = {
  id: string;
  mode: string;
  course_id: string | null;
  status: string;
  generated_plan: Record<string, unknown>;
  selected_items: unknown[];
};

export function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return sanitizePlainTextInput(value, maxLength).trim();
}

export function parseInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getRecommendedQuestionCount(level: PlannerLevel) {
  if (level === "advanced") return 9;
  if (level === "intermediate") return 8;
  return 7;
}

export function slugify(value: string) {
  return (
    sanitizePlainTextInput(value, 160)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

export function createTextId(prefix: string, value: string) {
  return `${prefix}-${slugify(value)}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
}

export function buildUrl(pathname: string, params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function parseNewCoursePlanInput(formData: FormData): NewCoursePlanInput {
  return requireValidPlannerForm<ValidatedNewCoursePlanInput>(
    parseNewCoursePlanInputForm(formData),
  );
}

export function requireValidPlannerForm<T>(result: ValidationResult<T>) {
  if (!result.ok) {
    throw new ValidationError(`Invalid AI planner form data. ${formatValidationIssues(result.issues)}`);
  }

  return result.data;
}

export function parseJsonArray<T>(
  value: FormDataEntryValue | null,
  fallback: T[],
  context: {
    field: string;
    operation: string;
  },
): T[] {
  if (value === null || value === undefined || String(value).trim().length === 0) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(String(value)) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }

    throw new ValidationError(`Expected ${context.field} to be a JSON array.`);
  } catch (error) {
    const appError =
      error instanceof ValidationError
        ? error
        : new ValidationError(`Could not parse ${context.field}.`, error);

    logAppError(appError, {
      operation: context.operation,
      metadata: { field: context.field },
    });
    throw appError;
  }
}

export function getSelectedNewCoursePlanSelection(plan: PlannerPlanRow) {
  const [firstItem] = Array.isArray(plan.selected_items) ? plan.selected_items : [];
  return parseStoredNewCoursePlanSelection(firstItem);
}

export function logInvalidPlannerRecord(operation: string, plan: PlannerPlanRow) {
  logAppError(new ValidationError("Stored AI course plan could not be parsed."), {
    operation,
    resourceId: plan.id,
    metadata: {
      mode: plan.mode,
      status: plan.status,
    },
  });
}

export function buildSelectedPlanSelection(
  option: NewCoursePlanOption,
  patch: Partial<StoredNewCoursePlanSelection> = {},
): StoredNewCoursePlanSelection {
  return {
    ...option,
    ...patch,
  };
}

export function summarizeBlock(block: PlannerBlockRow) {
  const payload = asObject(block.payload) ?? {};
  const candidates = [
    payload.heading,
    payload.title,
    payload.body,
    payload.caption,
    payload.alt,
    payload.transcript,
  ];

  return candidates
    .map((value) => asString(value, 180))
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
}

export function mergeNewCourseOptionEdits(
  formData: FormData,
  baseOption: NewCoursePlanOption,
): NewCoursePlanOption {
  const learningObjectives = parseJsonArray<string>(
    formData.get("learningObjectivesJson"),
    baseOption.learningObjectives,
    {
      field: "learningObjectivesJson",
      operation: "admin.course_planner.option.learning_objectives.parse",
    },
  )
    .map((item) => asString(item, 240))
    .filter(Boolean);
  const lessonOutline = parseJsonArray<NewCoursePlanOption["lessonOutline"][number]>(
    formData.get("lessonOutlineJson"),
    baseOption.lessonOutline,
    {
      field: "lessonOutlineJson",
      operation: "admin.course_planner.option.lesson_outline.parse",
    },
  )
    .map((lesson) => ({
      title: asString(lesson?.title, 160),
      purpose: asString(lesson?.purpose, 400),
      learningObjective: asString(lesson?.learningObjective, 240),
    }))
    .filter((lesson) => lesson.title && lesson.purpose && lesson.learningObjective);

  const levelRaw = asString(formData.get("selectedLevel"), 40, baseOption.level);
  const level: PlannerLevel =
    levelRaw === "advanced" ? "advanced" : levelRaw === "intermediate" ? "intermediate" : "beginner";

  return {
    title: asString(formData.get("selectedTitle"), 60, baseOption.title) || baseOption.title,
    description: asString(formData.get("selectedDescription"), 120, baseOption.description) || baseOption.description,
    courseGoal: asString(formData.get("selectedCourseGoal"), 400, baseOption.courseGoal) || baseOption.courseGoal,
    targetAudience:
      asString(formData.get("selectedTargetAudience"), 200, baseOption.targetAudience) || baseOption.targetAudience,
    level,
    tone: asString(formData.get("selectedTone"), 120, baseOption.tone) || baseOption.tone,
    learningObjectives: learningObjectives.length > 0 ? learningObjectives : baseOption.learningObjectives,
    lessonOutline: lessonOutline.length > 0 ? lessonOutline : baseOption.lessonOutline,
    quizStrategy: asString(formData.get("selectedQuizStrategy"), 500, baseOption.quizStrategy) || baseOption.quizStrategy,
    mediaStyle: asString(formData.get("selectedMediaStyle"), 500, baseOption.mediaStyle) || baseOption.mediaStyle,
    whyThisCourse:
      asString(formData.get("selectedWhyThisCourse"), 500, baseOption.whyThisCourse) || baseOption.whyThisCourse,
  };
}

export function buildSelectedCourseNotes(input: NewCoursePlanInput, option: NewCoursePlanOption) {
  const lines = [
    `Base idea: ${input.roughIdea}`,
    `Selected brief title: ${option.title}`,
    `Selected brief description: ${option.description}`,
    `Course goal: ${option.courseGoal}`,
    `Target audience: ${option.targetAudience}`,
    `Learning objectives: ${option.learningObjectives.join("; ")}`,
    `Lesson outline: ${option.lessonOutline.map((lesson, index) => `${index + 1}. ${lesson.title} - ${lesson.purpose} - objective: ${lesson.learningObjective}`).join(" | ")}`,
    `Quiz strategy: ${option.quizStrategy}`,
    `Media style: ${option.mediaStyle}`,
    `Why this course: ${option.whyThisCourse}`,
    input.notes ? `Original editor notes: ${input.notes}` : "",
    "Each lesson should be substantial, with 6 to 8 pages.",
    "Each lesson quiz should include at least 7 thoughtful questions that test understanding, not basic recall.",
    "Allow harder or more important questions to carry more XP than easier questions.",
    "Keep language simple, accurate, and safe for semi-literate to secondary-school learners.",
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildPlannedLessonsNotes(input: NewCoursePlanInput, option: NewCoursePlanOption) {
  const lines = [
    `Use the saved course brief titled "${option.title}".`,
    `Course description: ${option.description}`,
    `Course goal: ${option.courseGoal}`,
    `Target audience: ${option.targetAudience}`,
    `Overall learning objectives: ${option.learningObjectives.join("; ")}`,
    `Generate exactly ${option.lessonOutline.length} lessons in this order:`,
    ...option.lessonOutline.map(
      (lesson, index) => `${index + 1}. ${lesson.title} - purpose: ${lesson.purpose} - objective: ${lesson.learningObjective}`,
    ),
    `Quiz strategy: ${option.quizStrategy}`,
    `Media style: ${option.mediaStyle}`,
    input.notes ? `Original editor notes: ${input.notes}` : "",
    "Each lesson should be substantial, with 6 to 8 pages.",
    "Each lesson quiz should include at least 7 thoughtful questions that test understanding, not basic recall.",
    "Allow harder or more important questions to carry more XP than easier questions.",
    "Use the exact planned lesson titles unless a title would create duplication or a safety issue.",
    "Keep language simple, accurate, and safe for semi-literate to secondary-school learners.",
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildPlannedLessonsContinuityInstruction(option: NewCoursePlanOption) {
  const outline = option.lessonOutline
    .map(
      (lesson, index) =>
        `${index + 1}. Title: ${lesson.title}. Purpose: ${lesson.purpose}. Objective: ${lesson.learningObjective}.`,
    )
    .join(" ");

  return [
    `Create exactly ${option.lessonOutline.length} new lessons for this existing course.`,
    "Follow this outline order exactly.",
    outline,
    "Do not rename or merge the planned lessons unless needed to avoid duplication or unsafe content.",
    "Do not repeat earlier lessons. Each lesson should build naturally from the course brief.",
  ].join(" ");
}

export function buildExpansionDraftNotes(
  courseTitle: string,
  suggestion: CourseExpansionSuggestion,
  planAnalysis: CourseExpansionPlanResult["courseAnalysis"],
  notes: string,
) {
  const lines = [
    `Existing course: ${courseTitle}`,
    `Selected lesson idea: ${suggestion.title}`,
    `Why it belongs: ${suggestion.reason}`,
    `Suggested placement: ${suggestion.placement}`,
    `Learning objective: ${suggestion.learningObjective}`,
    `Suggested pages: ${suggestion.suggestedPages.map((page) => `${page.title} (${page.pageType}) - ${page.purpose}`).join(" | ")}`,
    `Quiz approach: ${suggestion.quizApproach}`,
    suggestion.mediaSuggestions.length > 0
      ? `Media suggestions: ${suggestion.mediaSuggestions.map((media) => `${media.assetType} at ${media.placement} - ${media.prompt}`).join(" | ")}`
      : "",
    planAnalysis.currentCoverage.length > 0
      ? `Current coverage: ${planAnalysis.currentCoverage.join("; ")}`
      : "",
    planAnalysis.gaps.length > 0 ? `Known gaps: ${planAnalysis.gaps.join("; ")}` : "",
    `Recommended direction: ${planAnalysis.recommendedDirection}`,
    notes ? `Editor notes: ${notes}` : "",
    "Each new lesson should be substantial, with 6 to 8 pages.",
    "Each lesson quiz should include at least 7 thoughtful questions that test understanding, not basic recall.",
    "Allow harder or more important questions to carry more XP than easier questions.",
    "Do not repeat existing lessons. Keep language simple, safe, and factual.",
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildExpansionContinuityInstruction(
  courseTitle: string,
  suggestion: CourseExpansionSuggestion,
  notes: string,
) {
  const lines = [
    `Create exactly one new lesson for the course "${courseTitle}".`,
    `Use this lesson title: ${suggestion.title}.`,
    `Place it as: ${suggestion.placement}.`,
    `It must deliver this learning objective: ${suggestion.learningObjective}.`,
    `It belongs in the course because: ${suggestion.reason}.`,
    "Do not duplicate earlier lessons or repeat the same quiz ideas.",
    "Keep examples safe, practical, and suitable for semi-literate to secondary-school learners.",
    notes ? `Editor notes: ${notes}` : "",
  ];

  return lines.filter(Boolean).join(" ");
}

export function getSelectedNewCourseOptionFromForm(
  plan: PlannerPlanRow,
  formData: FormData,
) {
  const optionIndex = parseInteger(formData.get("optionIndex"), 0);
  const stored = parseStoredNewCoursePlan(plan.generated_plan);

  if (!stored) {
    logInvalidPlannerRecord("admin.course_planner.selected_new_course_plan.parse", plan);
    throw new Error("The saved course brief is invalid.");
  }

  const baseOption = stored.result.options[optionIndex];
  if (!baseOption) {
    throw new Error("Selected brief option not found.");
  }

  return {
    stored,
    selectedOption: mergeNewCourseOptionEdits(formData, baseOption),
  };
}
