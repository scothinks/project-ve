import {
  formFailed,
  formOk,
  getFormEnum,
  getFormInteger,
  getFormString,
  getOptionalFormString,
} from "./form-data-validation.ts";
import type { ValidationIssue } from "./request-validation.ts";

type AiGeneratorLevel = "beginner" | "intermediate" | "advanced";
type PlannerLevel = "beginner" | "intermediate" | "advanced";
type CourseExpansionGoal =
  | "Add beginner lessons"
  | "Add advanced lessons"
  | "Add scenario/practice lessons"
  | "Add recap/assessment lesson"
  | "Fill topic gaps"
  | "Improve weak course progression"
  | "Create follow-up course";

export type ValidatedAiCourseGenerationInput = {
  topic: string;
  audience: string;
  region: string;
  difficulty: AiGeneratorLevel;
  tone: string;
  lessonCount: number;
  questionsPerLesson: number;
  notes: string;
};

export type ValidatedNewCoursePlanInput = {
  roughIdea: string;
  audience: string;
  region: string;
  level: PlannerLevel;
  tone: string;
  notes: string;
};

const levels = ["beginner", "intermediate", "advanced"] as const;
const expansionGoals = [
  "Add beginner lessons",
  "Add advanced lessons",
  "Add scenario/practice lessons",
  "Add recap/assessment lesson",
  "Fill topic gaps",
  "Improve weak course progression",
  "Create follow-up course",
] as const satisfies readonly CourseExpansionGoal[];

function result<T>(issues: ValidationIssue[], data: T) {
  return issues.length > 0 ? formFailed<T>(issues) : formOk(data);
}

export function parseAiGenerationInputForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  const data: ValidatedAiCourseGenerationInput = {
    audience: getFormString(formData, "audience", issues, { maxLength: 160 }) ?? "",
    difficulty: getFormEnum(formData, "difficulty", levels, issues, "beginner") ?? "beginner",
    lessonCount: getFormInteger(formData, "lessonCount", issues, {
      fallback: 4,
      max: 8,
      min: 1,
    }) ?? 4,
    notes: getOptionalFormString(formData, "notes", issues, {
      allowEmpty: true,
      maxLength: 4000,
    }),
    questionsPerLesson: getFormInteger(formData, "questionsPerLesson", issues, {
      fallback: 7,
      max: 12,
      min: 3,
    }) ?? 7,
    region: getFormString(formData, "region", issues, {
      maxLength: 120,
    }) ?? "",
    tone: getFormString(formData, "tone", issues, {
      maxLength: 120,
    }) ?? "",
    topic: getFormString(formData, "topic", issues, { maxLength: 160 }) ?? "",
  };

  return result(issues, data);
}

export function parseNewCoursePlanInputForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  const data: ValidatedNewCoursePlanInput = {
    audience: getFormString(formData, "audience", issues, { maxLength: 200 }) ?? "",
    level: (getFormEnum(formData, "level", levels, issues, "beginner") ?? "beginner") as PlannerLevel,
    notes: getOptionalFormString(formData, "notes", issues, {
      allowEmpty: true,
      maxLength: 2000,
    }),
    region: getFormString(formData, "region", issues, {
      maxLength: 120,
    }) ?? "",
    roughIdea: getFormString(formData, "roughIdea", issues, { maxLength: 500 }) ?? "",
    tone: getFormString(formData, "tone", issues, {
      maxLength: 120,
    }) ?? "",
  };

  return result(issues, data);
}

export function parseCourseExpansionPlanForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  const data = {
    courseId: getFormString(formData, "course_id", issues, { maxLength: 120 }) ?? "",
    expansionGoal: getFormEnum(formData, "expansion_goal", expansionGoals, issues, "Fill topic gaps") ?? "Fill topic gaps",
    notes: getOptionalFormString(formData, "notes", issues, {
      allowEmpty: true,
      maxLength: 2000,
    }),
    numberOfSuggestions: getFormInteger(formData, "number_of_suggestions", issues, {
      fallback: 3,
      max: 6,
      min: 1,
    }) ?? 3,
  };

  return result(issues, data);
}
