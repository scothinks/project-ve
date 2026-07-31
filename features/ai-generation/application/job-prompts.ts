import { sanitizePlainTextInput } from "../../../lib/input-safety.ts";
import type { AiCourseGenerationInput } from "../../../lib/ai-learning-generator.ts";

const MIN_LESSONS = 1;
const MAX_LESSONS = 8;
const MIN_QUESTIONS = 7;
const MAX_QUESTIONS = 10;

export type MediaJobMode = "course_media" | "lesson_media" | "single_media_asset";

export function getPromptString(prompt: Record<string, unknown>, key: string) {
  const value = prompt[key];
  return typeof value === "string" ? value : "";
}

export function getPromptNumber(prompt: Record<string, unknown>, key: string, fallback: number) {
  const value = prompt[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getPromptBoolean(prompt: Record<string, unknown>, key: string) {
  return prompt[key] === true;
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function asString(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return sanitizePlainTextInput(value, maxLength).trim();
}

function normalizeAiGenerationRequest(input: AiCourseGenerationInput): AiCourseGenerationInput {
  return {
    topic: asString(input.topic, 160),
    audience: asString(input.audience, 160),
    region: asString(input.region, 120),
    difficulty: input.difficulty,
    tone: asString(input.tone, 120),
    lessonCount: clampInteger(input.lessonCount, MIN_LESSONS, MAX_LESSONS),
    questionsPerLesson: clampInteger(input.questionsPerLesson, MIN_QUESTIONS, MAX_QUESTIONS),
    notes: asString(input.notes, 4000),
  };
}

export function getMediaJobMode(prompt: Record<string, unknown>): MediaJobMode | "" {
  const mode = getPromptString(prompt, "mode");
  if (mode === "course_media" || mode === "lesson_media" || mode === "single_media_asset") {
    return mode;
  }

  if (getPromptString(prompt, "assetId")) {
    return "single_media_asset";
  }

  if (getPromptString(prompt, "lessonId")) {
    return "lesson_media";
  }

  if (getPromptString(prompt, "courseId")) {
    return "course_media";
  }

  return "";
}

export function getPromptInput(prompt: Record<string, unknown>): AiCourseGenerationInput {
  return normalizeAiGenerationRequest({
    audience: getPromptString(prompt, "audience"),
    difficulty:
      getPromptString(prompt, "difficulty") === "advanced"
        ? "advanced"
        : getPromptString(prompt, "difficulty") === "intermediate"
          ? "intermediate"
          : "beginner",
    lessonCount: getPromptNumber(prompt, "lessonCount", 4),
    notes: getPromptString(prompt, "notes"),
    questionsPerLesson: getPromptNumber(prompt, "questionsPerLesson", 7),
    region: getPromptString(prompt, "region"),
    tone: getPromptString(prompt, "tone"),
    topic: getPromptString(prompt, "topic"),
  });
}
