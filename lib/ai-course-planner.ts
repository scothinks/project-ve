import "server-only";

import { sanitizePlainTextInput } from "@/lib/input-safety";

export type PlannerLevel = "beginner" | "intermediate" | "advanced";
export type PlannerPageType = "concept" | "scenario" | "reflection" | "summary";
export type PlannerAssetType = "image" | "infographic" | "thumbnail" | "cover";
export type CourseExpansionGoal =
  | "Add beginner lessons"
  | "Add advanced lessons"
  | "Add scenario/practice lessons"
  | "Add recap/assessment lesson"
  | "Fill topic gaps"
  | "Improve weak course progression"
  | "Create follow-up course";

export type NewCoursePlanInput = {
  roughIdea: string;
  audience: string;
  region: string;
  level: PlannerLevel;
  tone: string;
  notes?: string;
};

export type NewCoursePlanOption = {
  title: string;
  description: string;
  courseGoal: string;
  targetAudience: string;
  level: PlannerLevel;
  tone: string;
  learningObjectives: string[];
  lessonOutline: Array<{
    title: string;
    purpose: string;
    learningObjective: string;
  }>;
  quizStrategy: string;
  mediaStyle: string;
  whyThisCourse: string;
};

export type NewCoursePlanResult = {
  options: NewCoursePlanOption[];
};

export type CourseExpansionContext = {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  courseCategory: string;
  courseLevel: PlannerLevel;
  existingLessons: Array<{
    title: string;
    description: string;
    pages: Array<{
      title: string;
      pageType: string;
      summary: string;
    }>;
    quizSummary: string;
  }>;
  expansionGoal: CourseExpansionGoal;
  numberOfSuggestions: number;
  notes?: string;
};

export type CourseExpansionSuggestion = {
  title: string;
  reason: string;
  placement: string;
  learningObjective: string;
  difficulty: PlannerLevel;
  estimatedMinutes: number;
  suggestedPages: Array<{
    title: string;
    pageType: PlannerPageType;
    purpose: string;
  }>;
  quizApproach: string;
  mediaSuggestions: Array<{
    assetType: PlannerAssetType;
    placement: string;
    prompt: string;
    altText: string;
    caption: string;
  }>;
};

export type CourseExpansionPlanResult = {
  courseAnalysis: {
    currentCoverage: string[];
    gaps: string[];
    recommendedDirection: string;
  };
  lessonSuggestions: CourseExpansionSuggestion[];
};

export type StoredNewCoursePlan = {
  input: NewCoursePlanInput;
  result: NewCoursePlanResult;
};

export type StoredNewCoursePlanSelection = NewCoursePlanOption & {
  generatedCourseId?: string;
  courseShellCreatedAt?: string;
  lessonsGeneratedAt?: string;
  lessonsGeneratedCount?: number;
};

export type StoredCourseExpansionPlan = {
  input: CourseExpansionContext;
  result: CourseExpansionPlanResult;
};

const DEFAULT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.4-mini";
const MAX_NEW_OPTIONS = 3;
const MAX_LEARNING_OBJECTIVES = 8;
const MAX_OUTLINE_LESSONS = 10;
const MAX_EXISTING_LESSONS = 16;
const MAX_SUGGESTED_PAGES = 6;
const MAX_MEDIA_SUGGESTIONS = 6;
const MAX_EXPANSION_SUGGESTIONS = 6;
const MAX_COURSE_TITLE_LENGTH = 60;
const MAX_COURSE_DESCRIPTION_LENGTH = 120;

const NEW_COURSE_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["options"],
  properties: {
    options: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "courseGoal",
          "targetAudience",
          "level",
          "tone",
          "learningObjectives",
          "lessonOutline",
          "quizStrategy",
          "mediaStyle",
          "whyThisCourse",
        ],
        properties: {
          title: { type: "string", maxLength: MAX_COURSE_TITLE_LENGTH },
          description: { type: "string", maxLength: MAX_COURSE_DESCRIPTION_LENGTH },
          courseGoal: { type: "string" },
          targetAudience: { type: "string" },
          level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          tone: { type: "string" },
          learningObjectives: {
            type: "array",
            items: { type: "string" },
          },
          lessonOutline: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "purpose", "learningObjective"],
              properties: {
                title: { type: "string" },
                purpose: { type: "string" },
                learningObjective: { type: "string" },
              },
            },
          },
          quizStrategy: { type: "string" },
          mediaStyle: { type: "string" },
          whyThisCourse: { type: "string" },
        },
      },
    },
  },
} as const;

const EXPANSION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["courseAnalysis", "lessonSuggestions"],
  properties: {
    courseAnalysis: {
      type: "object",
      additionalProperties: false,
      required: ["currentCoverage", "gaps", "recommendedDirection"],
      properties: {
        currentCoverage: {
          type: "array",
          items: { type: "string" },
        },
        gaps: {
          type: "array",
          items: { type: "string" },
        },
        recommendedDirection: { type: "string" },
      },
    },
    lessonSuggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "reason",
          "placement",
          "learningObjective",
          "difficulty",
          "estimatedMinutes",
          "suggestedPages",
          "quizApproach",
          "mediaSuggestions",
        ],
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          placement: { type: "string" },
          learningObjective: { type: "string" },
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          estimatedMinutes: { type: "number" },
          suggestedPages: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "pageType", "purpose"],
              properties: {
                title: { type: "string" },
                pageType: { type: "string", enum: ["concept", "scenario", "reflection", "summary"] },
                purpose: { type: "string" },
              },
            },
          },
          quizApproach: { type: "string" },
          mediaSuggestions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["assetType", "placement", "prompt", "altText", "caption"],
              properties: {
                assetType: {
                  type: "string",
                  enum: ["image", "infographic", "thumbnail", "cover"],
                },
                placement: { type: "string" },
                prompt: { type: "string" },
                altText: { type: "string" },
                caption: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return sanitizePlainTextInput(value, maxLength).trim();
}

function asStringArray(value: unknown, maxItems: number, itemMaxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => asString(item, itemMaxLength))
    .filter(Boolean);
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function extractResponseText(payload: Record<string, unknown>) {
  const directText = payload.output_text;
  if (typeof directText === "string" && directText.trim()) {
    return directText.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const record = asObject(item);
    const content = Array.isArray(record?.content) ? record.content : [];
    for (const contentItem of content) {
      const contentRecord = asObject(contentItem);
      const textValue = contentRecord?.text;
      if (typeof textValue === "string" && textValue.trim()) {
        return textValue.trim();
      }
      const nested = asObject(contentRecord?.output_text);
      if (typeof nested?.text === "string" && nested.text.trim()) {
        return nested.text.trim();
      }
    }
  }

  return "";
}

function normalizeLevel(value: unknown, fallback: PlannerLevel = "beginner"): PlannerLevel {
  const normalized = asString(value, 40);
  if (normalized === "intermediate" || normalized === "advanced") {
    return normalized;
  }
  return fallback;
}

function normalizePageType(value: unknown): PlannerPageType {
  const normalized = asString(value, 40);
  if (normalized === "scenario" || normalized === "reflection" || normalized === "summary") {
    return normalized;
  }
  return "concept";
}

function normalizeAssetType(value: unknown): PlannerAssetType {
  const normalized = asString(value, 40);
  if (
    normalized === "infographic"
    || normalized === "thumbnail"
    || normalized === "cover"
  ) {
    return normalized;
  }
  return "image";
}

export function normalizeNewCoursePlanInput(input: NewCoursePlanInput): NewCoursePlanInput {
  return {
    roughIdea: asString(input.roughIdea, 500),
    audience: asString(input.audience, 200),
    region: asString(input.region, 120),
    level: normalizeLevel(input.level),
    tone: asString(input.tone, 120),
    notes: asString(input.notes ?? "", 2000),
  };
}

export function normalizeCourseExpansionContext(input: CourseExpansionContext): CourseExpansionContext {
  return {
    courseId: asString(input.courseId, 120),
    courseTitle: asString(input.courseTitle, 160),
    courseDescription: asString(input.courseDescription, 1500),
    courseCategory: asString(input.courseCategory, 120),
    courseLevel: normalizeLevel(input.courseLevel),
    existingLessons: Array.isArray(input.existingLessons)
      ? input.existingLessons.slice(0, MAX_EXISTING_LESSONS).map((lesson) => ({
          title: asString(lesson.title, 160),
          description: asString(lesson.description, 1000),
          pages: Array.isArray(lesson.pages)
            ? lesson.pages.slice(0, MAX_SUGGESTED_PAGES).map((page) => ({
                title: asString(page.title, 160),
                pageType: asString(page.pageType, 60),
                summary: asString(page.summary, 600),
              }))
            : [],
          quizSummary: asString(lesson.quizSummary, 800),
        }))
      : [],
    expansionGoal: input.expansionGoal,
    numberOfSuggestions: clampInteger(input.numberOfSuggestions, 1, MAX_EXPANSION_SUGGESTIONS),
    notes: asString(input.notes ?? "", 2000),
  };
}

function normalizeNewCoursePlanOption(value: unknown): NewCoursePlanOption | null {
  const option = asObject(value);
  if (!option) return null;

  const learningObjectives = asStringArray(option.learningObjectives, MAX_LEARNING_OBJECTIVES, 240);
  const lessonOutline = Array.isArray(option.lessonOutline)
    ? option.lessonOutline
        .slice(0, MAX_OUTLINE_LESSONS)
        .map((rawLesson) => {
          const lesson = asObject(rawLesson);
          if (!lesson) return null;
          const title = asString(lesson.title, 160);
          const purpose = asString(lesson.purpose, 400);
          const learningObjective = asString(lesson.learningObjective, 240);
          if (!title || !purpose || !learningObjective) return null;
          return { title, purpose, learningObjective };
        })
        .filter((lesson): lesson is NonNullable<typeof lesson> => Boolean(lesson))
    : [];

  const normalized = {
    title: asString(option.title, MAX_COURSE_TITLE_LENGTH),
    description: asString(option.description, MAX_COURSE_DESCRIPTION_LENGTH),
    courseGoal: asString(option.courseGoal, 400),
    targetAudience: asString(option.targetAudience, 200),
    level: normalizeLevel(option.level),
    tone: asString(option.tone, 120),
    learningObjectives,
    lessonOutline,
    quizStrategy: asString(option.quizStrategy, 500),
    mediaStyle: asString(option.mediaStyle, 500),
    whyThisCourse: asString(option.whyThisCourse, 500),
  };

  if (
    !normalized.title
    || !normalized.description
    || !normalized.courseGoal
    || !normalized.targetAudience
    || !normalized.tone
    || normalized.learningObjectives.length === 0
    || normalized.lessonOutline.length === 0
    || !normalized.quizStrategy
    || !normalized.mediaStyle
    || !normalized.whyThisCourse
  ) {
    return null;
  }

  return normalized;
}

function normalizeNewCoursePlanResult(value: unknown): NewCoursePlanResult {
  const record = asObject(value);
  const options = Array.isArray(record?.options)
    ? record.options
        .map(normalizeNewCoursePlanOption)
        .filter((option): option is NewCoursePlanOption => Boolean(option))
    : [];

  if (options.length < MAX_NEW_OPTIONS) {
    throw new Error("The AI planner returned too few valid course brief options.");
  }

  return {
    options: options.slice(0, MAX_NEW_OPTIONS),
  };
}

function normalizeExpansionSuggestion(value: unknown): CourseExpansionSuggestion | null {
  const suggestion = asObject(value);
  if (!suggestion) return null;

  const suggestedPages = Array.isArray(suggestion.suggestedPages)
    ? suggestion.suggestedPages
        .slice(0, MAX_SUGGESTED_PAGES)
        .map((rawPage) => {
          const page = asObject(rawPage);
          if (!page) return null;
          const title = asString(page.title, 160);
          const purpose = asString(page.purpose, 400);
          if (!title || !purpose) return null;
          return {
            title,
            pageType: normalizePageType(page.pageType),
            purpose,
          };
        })
        .filter((page): page is NonNullable<typeof page> => Boolean(page))
    : [];

  const mediaSuggestions = Array.isArray(suggestion.mediaSuggestions)
    ? suggestion.mediaSuggestions
        .slice(0, MAX_MEDIA_SUGGESTIONS)
        .map((rawMedia) => {
          const media = asObject(rawMedia);
          if (!media) return null;
          const placement = asString(media.placement, 120);
          const prompt = asString(media.prompt, 1000);
          const altText = asString(media.altText, 240);
          const caption = asString(media.caption, 500);
          if (!placement || !prompt || !altText || !caption) return null;
          return {
            assetType: normalizeAssetType(media.assetType),
            placement,
            prompt,
            altText,
            caption,
          };
        })
        .filter((media): media is NonNullable<typeof media> => Boolean(media))
    : [];

  const normalized = {
    title: asString(suggestion.title, 160),
    reason: asString(suggestion.reason, 500),
    placement: asString(suggestion.placement, 240),
    learningObjective: asString(suggestion.learningObjective, 240),
    difficulty: normalizeLevel(suggestion.difficulty),
    estimatedMinutes: clampInteger(Number(suggestion.estimatedMinutes ?? 15), 5, 90),
    suggestedPages,
    quizApproach: asString(suggestion.quizApproach, 500),
    mediaSuggestions,
  };

  if (
    !normalized.title
    || !normalized.reason
    || !normalized.placement
    || !normalized.learningObjective
    || normalized.suggestedPages.length === 0
    || !normalized.quizApproach
  ) {
    return null;
  }

  return normalized;
}

function normalizeCourseExpansionPlanResult(value: unknown, suggestionCount: number): CourseExpansionPlanResult {
  const record = asObject(value);
  const courseAnalysis = asObject(record?.courseAnalysis);
  if (!courseAnalysis) {
    throw new Error("The AI planner returned an invalid course analysis.");
  }

  const lessonSuggestions = Array.isArray(record?.lessonSuggestions)
    ? record.lessonSuggestions
        .map(normalizeExpansionSuggestion)
        .filter((suggestion): suggestion is CourseExpansionSuggestion => Boolean(suggestion))
    : [];

  if (lessonSuggestions.length === 0) {
    throw new Error("The AI planner did not return any valid lesson suggestions.");
  }

  return {
    courseAnalysis: {
      currentCoverage: asStringArray(courseAnalysis.currentCoverage, 12, 240),
      gaps: asStringArray(courseAnalysis.gaps, 12, 240),
      recommendedDirection: asString(courseAnalysis.recommendedDirection, 500),
    },
    lessonSuggestions: lessonSuggestions.slice(0, suggestionCount),
  };
}

function buildNewCoursePrompt(input: NewCoursePlanInput) {
  return [
    "You are planning safe educational courses for editors.",
    "Return exactly 3 distinct course brief options.",
    "The audience may include semi-literate to secondary-school learners, so use simple, clear language.",
    `Keep each course title short and card-friendly: no more than ${MAX_COURSE_TITLE_LENGTH} characters and usually 2 to 6 words.`,
    `Keep each course description concise: one short learner-facing sentence, no more than ${MAX_COURSE_DESCRIPTION_LENGTH} characters.`,
    "Guardrails:",
    "- avoid fake facts or invented statistics",
    "- avoid political party propaganda",
    "- avoid unsafe advice",
    "- avoid real public figures unless the source material explicitly requires them",
    "- keep examples practical and culturally respectful",
    "- build a logical lesson flow from basic ideas to practice and recap",
    "",
    `Rough idea or problem: ${input.roughIdea}`,
    `Audience: ${input.audience}`,
    `Region: ${input.region}`,
    `Level: ${input.level}`,
    `Tone: ${input.tone}`,
    input.notes ? `Editor notes: ${input.notes}` : "",
    "",
    "For each option, propose:",
    "- a clear, concise course title and a very short description",
    "- a practical course goal",
    "- target audience wording that matches the brief",
    "- 3 to 8 learning objectives",
    "- a lesson outline with a useful sequence",
    "- quiz strategy and media style guidance",
    "- a short explanation of why this course is worth creating",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildExpansionPrompt(input: CourseExpansionContext) {
  const lessonLines = input.existingLessons.length > 0
    ? input.existingLessons.map((lesson, index) => {
        const pageSummary = lesson.pages.length > 0
          ? lesson.pages.map((page) => `  - ${page.title} (${page.pageType}): ${page.summary}`).join("\n")
          : "  - No page summary available.";
        return [
          `${index + 1}. ${lesson.title}`,
          `Description: ${lesson.description || "No description."}`,
          "Pages:",
          pageSummary,
          `Quiz: ${lesson.quizSummary || "No quiz summary."}`,
        ].join("\n");
      }).join("\n\n")
    : "No lessons exist yet.";

  return [
    "You are helping an editor expand an existing educational course.",
    "Return strict JSON only.",
    "Keep language simple for semi-literate to secondary-school learners.",
    "Do not duplicate existing lessons. Each suggestion must explain why it belongs in this course.",
    "Guardrails:",
    "- avoid fake facts or invented statistics",
    "- avoid political party propaganda",
    "- avoid unsafe advice",
    "- avoid real public figures unless the source material explicitly requires them",
    "- make the course progression more coherent, not more confusing",
    "",
    `Course title: ${input.courseTitle}`,
    `Course description: ${input.courseDescription}`,
    `Course category: ${input.courseCategory}`,
    `Course level: ${input.courseLevel}`,
    `Expansion goal: ${input.expansionGoal}`,
    `Requested suggestions: ${input.numberOfSuggestions}`,
    input.notes ? `Editor notes: ${input.notes}` : "",
    "",
    "Existing lessons, page summaries, and quiz summaries:",
    lessonLines,
    "",
    "Analyze current coverage, note the biggest gaps, and suggest the next lessons that best improve the course.",
    "Suggested pages should be practical and believable.",
    "Media prompts should support safe, simple educational visuals.",
    "For now only suggest image, infographic, thumbnail, or cover assets.",
    "Do not suggest audio or video assets in mediaSuggestions.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function requestPlannerResponse(schemaName: string, schema: object, prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to the server environment before generating AI plans.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_TEXT_MODEL,
      store: false,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are an educational planner. Return strict JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema,
          strict: true,
        },
      },
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const apiError = asObject(payload.error);
    const message = asString(apiError?.message, 500) || "The AI planner request failed.";
    throw new Error(message);
  }

  const rawText = extractResponseText(payload);
  if (!rawText) {
    throw new Error("The AI planner returned an empty response.");
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    throw new Error("The AI planner returned invalid JSON.");
  }
}

export async function generateNewCoursePlans(rawInput: NewCoursePlanInput): Promise<NewCoursePlanResult> {
  const input = normalizeNewCoursePlanInput(rawInput);
  if (!input.roughIdea || !input.audience || !input.region || !input.tone) {
    throw new Error("Rough idea, audience, region, and tone are required.");
  }

  const parsed = await requestPlannerResponse(
    "new_course_planner",
    NEW_COURSE_RESPONSE_SCHEMA,
    buildNewCoursePrompt(input),
  );

  return normalizeNewCoursePlanResult(parsed);
}

export async function generateCourseExpansionPlans(
  rawInput: CourseExpansionContext,
): Promise<CourseExpansionPlanResult> {
  const input = normalizeCourseExpansionContext(rawInput);
  if (!input.courseId || !input.courseTitle || !input.courseDescription || !input.courseCategory) {
    throw new Error("Course context is incomplete for AI expansion planning.");
  }

  const parsed = await requestPlannerResponse(
    "course_expansion_planner",
    EXPANSION_RESPONSE_SCHEMA,
    buildExpansionPrompt(input),
  );

  return normalizeCourseExpansionPlanResult(parsed, input.numberOfSuggestions);
}

export function parseStoredNewCoursePlan(value: unknown) {
  const record = asObject(value);
  if (!record) return null;
  const input = asObject(record.input);

  try {
    if (!input) return null;
    return {
      input: normalizeNewCoursePlanInput(input as unknown as NewCoursePlanInput),
      result: normalizeNewCoursePlanResult(record.result),
    } satisfies StoredNewCoursePlan;
  } catch {
    return null;
  }
}

export function parseStoredNewCoursePlanSelection(value: unknown) {
  const option = normalizeNewCoursePlanOption(value);
  if (!option) return null;

  const record = asObject(value);
  return {
    ...option,
    generatedCourseId: asString(record?.generatedCourseId, 120) || undefined,
    courseShellCreatedAt: asString(record?.courseShellCreatedAt, 80) || undefined,
    lessonsGeneratedAt: asString(record?.lessonsGeneratedAt, 80) || undefined,
    lessonsGeneratedCount: clampInteger(Number(record?.lessonsGeneratedCount ?? option.lessonOutline.length), 0, 50),
  } satisfies StoredNewCoursePlanSelection;
}

export function parseStoredCourseExpansionPlan(value: unknown) {
  const record = asObject(value);
  if (!record) return null;
  const input = asObject(record.input);

  try {
    if (!input) return null;
    const normalizedInput = normalizeCourseExpansionContext(input as unknown as CourseExpansionContext);
    return {
      input: normalizedInput,
      result: normalizeCourseExpansionPlanResult(record.result, normalizedInput.numberOfSuggestions),
    } satisfies StoredCourseExpansionPlan;
  } catch {
    return null;
  }
}
