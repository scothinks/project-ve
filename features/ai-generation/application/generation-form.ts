import {
  parseAiGenerationInputForm,
  type ValidatedAiCourseGenerationInput,
} from "../../../lib/admin-ai-validation.ts";
import { ValidationError } from "../../../lib/app-errors.ts";
import { formatValidationIssues } from "../../../lib/form-data-validation.ts";
import { sanitizePlainTextInput } from "../../../lib/input-safety.ts";
import type { ValidationResult } from "../../../lib/request-validation.ts";

type AiCourseGenerationInput = ValidatedAiCourseGenerationInput;

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function requireValidAiForm<T>(result: ValidationResult<T>) {
  if (!result.ok) {
    throw new ValidationError(`Invalid AI course form data. ${formatValidationIssues(result.issues)}`);
  }

  return result.data;
}

function clampAiGenerationInput(input: AiCourseGenerationInput): AiCourseGenerationInput {
  return {
    topic: sanitizePlainTextInput(input.topic, 160),
    audience: sanitizePlainTextInput(input.audience, 160),
    region: sanitizePlainTextInput(input.region, 120),
    difficulty: input.difficulty,
    tone: sanitizePlainTextInput(input.tone, 120),
    lessonCount: clampInteger(input.lessonCount, 1, 8),
    questionsPerLesson: clampInteger(input.questionsPerLesson, 3, 12),
    notes: sanitizePlainTextInput(input.notes, 4000),
  };
}

export function parseAiGenerationInput(formData: FormData): AiCourseGenerationInput {
  const input = requireValidAiForm<ValidatedAiCourseGenerationInput>(
    parseAiGenerationInputForm(formData),
  );

  return clampAiGenerationInput(input);
}
