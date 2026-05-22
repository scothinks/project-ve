import "server-only";

import { sanitizePlainTextInput } from "@/lib/input-safety";

export type AiGeneratorLevel = "beginner" | "intermediate" | "advanced";
export type AiGeneratorPageType = "concept" | "scenario" | "reflection" | "summary";
export type AiGeneratorBlockType = "text" | "callout" | "image" | "video" | "audio" | "table";
export type AiGeneratorAssetType =
  | "image"
  | "audio"
  | "video"
  | "infographic"
  | "thumbnail"
  | "cover";

export type AiCourseGenerationInput = {
  topic: string;
  audience: string;
  region: string;
  difficulty: AiGeneratorLevel;
  tone: string;
  lessonCount: number;
  questionsPerLesson: number;
  notes: string;
};

export type AiGeneratedBlock = {
  blockType: AiGeneratorBlockType;
  payload: Record<string, unknown>;
};

export type AiGeneratedPage = {
  title: string;
  subtitle: string;
  pageType: AiGeneratorPageType;
  blocks: AiGeneratedBlock[];
};

export type AiGeneratedQuestion = {
  prompt: string;
  questionType: "single_choice";
  explanation: string;
  xp: number;
  options: Array<{
    label: string;
    isCorrect: boolean;
  }>;
};

export type AiGeneratedLesson = {
  title: string;
  description: string;
  estimatedMinutes: number;
  pages: AiGeneratedPage[];
  quiz: {
    title: string;
    questions: AiGeneratedQuestion[];
  };
  mediaBriefs: Array<{
    assetType: AiGeneratorAssetType;
    placement: string;
    prompt: string;
    script: string;
    altText: string;
    caption: string;
  }>;
};

export type AiGeneratedCourseDraft = {
  course: {
    title: string;
    description: string;
    category: string;
    level: AiGeneratorLevel;
    estimatedMinutes: number;
  };
  lessons: AiGeneratedLesson[];
};

const DEFAULT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.4-mini";
const DEFAULT_REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL || "gpt-5.4-mini";

const MIN_LESSONS = 1;
const MAX_LESSONS = 8;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 6;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["course", "lessons"],
  properties: {
    course: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description", "category", "level", "estimatedMinutes"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        estimatedMinutes: { type: "number" },
      },
    },
    lessons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "estimatedMinutes", "pages", "quiz", "mediaBriefs"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          estimatedMinutes: { type: "number" },
          pages: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "subtitle", "pageType", "blocks"],
              properties: {
                title: { type: "string" },
                subtitle: { type: "string" },
                pageType: {
                  type: "string",
                  enum: ["concept", "scenario", "reflection", "summary"],
                },
                blocks: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["blockType", "payload"],
                    properties: {
                      blockType: {
                        type: "string",
                        enum: ["text", "callout", "image", "video", "audio", "table"],
                      },
                      payload: { type: "object" },
                    },
                  },
                },
              },
            },
          },
          quiz: {
            type: "object",
            additionalProperties: false,
            required: ["title", "questions"],
            properties: {
              title: { type: "string" },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["prompt", "questionType", "explanation", "xp", "options"],
                  properties: {
                    prompt: { type: "string" },
                    questionType: { type: "string", enum: ["single_choice"] },
                    explanation: { type: "string" },
                    xp: { type: "number" },
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["label", "isCorrect"],
                        properties: {
                          label: { type: "string" },
                          isCorrect: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          mediaBriefs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["assetType", "placement", "prompt", "script", "altText", "caption"],
              properties: {
                assetType: {
                  type: "string",
                  enum: ["image", "audio", "video", "infographic", "thumbnail", "cover"],
                },
                placement: { type: "string" },
                prompt: { type: "string" },
                script: { type: "string" },
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

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

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

function buildPrompt(input: AiCourseGenerationInput) {
  return [
    "Create a safe, plain-language values education course draft as strict JSON.",
    `Topic: ${input.topic}`,
    `Target audience: ${input.audience}`,
    `Country or region: ${input.region}`,
    `Difficulty: ${input.difficulty}`,
    `Tone: ${input.tone}`,
    `Number of lessons: ${input.lessonCount}`,
    `Questions per lesson: ${input.questionsPerLesson}`,
    `Notes and source guidance: ${input.notes || "None provided."}`,
    "Requirements:",
    "- Use simple language suitable for semi-literate to secondary-school learners.",
    "- Avoid party propaganda, hate, sexual content, medical advice, legal advice, financial advice, or unsafe instructions.",
    "- Use culturally neutral, regionally relevant everyday examples and avoid fake facts or precise claims you cannot support.",
    "- Keep page blocks mostly text, callout, and table. Put visual or audio ideas in mediaBriefs instead of depending on real URLs.",
    "- Each lesson must have at least 2 pages and at least 1 media brief.",
    "- Each quiz question must be single_choice with 2 to 4 options and exactly 1 correct answer.",
    "- Keep table payloads simple: columns as short labels and rows as arrays of short strings.",
  ].join("\n");
}

function normalizeBlockPayload(blockType: AiGeneratorBlockType, payload: Record<string, unknown>) {
  if (blockType === "callout") {
    return {
      variant: ["tip", "warning", "example"].includes(asString(payload.variant, 24))
        ? asString(payload.variant, 24)
        : "key_point",
      title: asString(payload.title ?? payload.heading, 180),
      body: asString(payload.body, 2000),
    };
  }

  if (blockType === "image") {
    return {
      alt: asString(payload.alt, 240),
      caption: asString(payload.caption, 500),
    };
  }

  if (blockType === "video" || blockType === "audio") {
    return {
      title: asString(payload.title ?? payload.heading, 180),
      caption: asString(payload.caption, 500),
      transcript: asString(payload.transcript ?? payload.body, 2000),
    };
  }

  if (blockType === "table") {
    const columns = asStringArray(payload.columns, 5, 60);
    const rows = Array.isArray(payload.rows)
      ? payload.rows
          .slice(0, 6)
          .map((row) =>
            Array.isArray(row)
              ? row.slice(0, 5).map((cell) => asString(cell, 120)).filter(Boolean)
              : [],
          )
          .filter((row) => row.length > 0)
      : [];

    return {
      title: asString(payload.title ?? payload.heading, 180),
      columns,
      rows,
      caption: asString(payload.caption, 500),
    };
  }

  return {
    heading: asString(payload.heading ?? payload.title, 180),
    body: asString(payload.body, 3000),
  };
}

function normalizeQuestionOptions(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Each AI-generated question needs 2 to 4 options.");
  }

  const normalized = value
    .slice(0, 4)
    .map((option) => {
      const optionRecord = asObject(option) ?? {};
      return {
        label: asString(optionRecord.label, 240),
        isCorrect: Boolean(optionRecord.isCorrect),
      };
    })
    .filter((option) => option.label);

  if (normalized.length < 2 || normalized.length > 4) {
    throw new Error("Each AI-generated question needs 2 to 4 options.");
  }

  const firstCorrectIndex = normalized.findIndex((option) => option.isCorrect);
  if (firstCorrectIndex < 0) {
    normalized[0].isCorrect = true;
  } else {
    normalized.forEach((option, index) => {
      option.isCorrect = index === firstCorrectIndex;
    });
  }

  return normalized;
}

function normalizeDraftShape(raw: unknown, input: AiCourseGenerationInput): AiGeneratedCourseDraft {
  const record = asObject(raw);
  const rawCourse = asObject(record?.course);
  const rawLessons = Array.isArray(record?.lessons) ? record.lessons : null;

  if (!rawCourse || !rawLessons || rawLessons.length === 0) {
    throw new Error("The AI response did not include a usable course and lessons array.");
  }

  const lessons = rawLessons.slice(0, input.lessonCount).map((lessonValue, lessonIndex) => {
    const lessonRecord = asObject(lessonValue);
    if (!lessonRecord) {
      throw new Error(`Lesson ${lessonIndex + 1} is malformed.`);
    }

    const rawPages = Array.isArray(lessonRecord.pages) ? lessonRecord.pages : [];
    if (rawPages.length === 0) {
      throw new Error(`Lesson ${lessonIndex + 1} is missing pages.`);
    }

    const pages = rawPages.slice(0, 6).map((pageValue, pageIndex) => {
      const pageRecord = asObject(pageValue);
      if (!pageRecord) {
        throw new Error(`Lesson ${lessonIndex + 1}, page ${pageIndex + 1} is malformed.`);
      }

      const rawBlocks = Array.isArray(pageRecord.blocks) ? pageRecord.blocks : [];
      if (rawBlocks.length === 0) {
        throw new Error(`Lesson ${lessonIndex + 1}, page ${pageIndex + 1} has no content blocks.`);
      }

      const pageType = asString(pageRecord.pageType, 40) as AiGeneratorPageType;
      if (!["concept", "scenario", "reflection", "summary"].includes(pageType)) {
        throw new Error(`Lesson ${lessonIndex + 1}, page ${pageIndex + 1} has an invalid page type.`);
      }

      const blocks = rawBlocks.slice(0, 6).map((blockValue, blockIndex) => {
        const blockRecord = asObject(blockValue);
        if (!blockRecord) {
          throw new Error(`Lesson ${lessonIndex + 1}, page ${pageIndex + 1}, block ${blockIndex + 1} is malformed.`);
        }

        const blockType = asString(blockRecord.blockType, 40) as AiGeneratorBlockType;
        if (!["text", "callout", "image", "video", "audio", "table"].includes(blockType)) {
          throw new Error(`Lesson ${lessonIndex + 1}, page ${pageIndex + 1} has an invalid block type.`);
        }

        const payload = normalizeBlockPayload(blockType, asObject(blockRecord.payload) ?? {});
        if (blockType === "text" && !payload.body) {
          throw new Error(`Lesson ${lessonIndex + 1}, page ${pageIndex + 1} needs text content.`);
        }
        if (blockType === "callout" && !payload.body) {
          throw new Error(`Lesson ${lessonIndex + 1}, page ${pageIndex + 1} needs callout text.`);
        }

        return {
          blockType,
          payload,
        };
      });

      return {
        title: asString(pageRecord.title, 160),
        subtitle: asString(pageRecord.subtitle, 300),
        pageType,
        blocks,
      };
    });

    const rawQuiz = asObject(lessonRecord.quiz);
    const rawQuestions = Array.isArray(rawQuiz?.questions) ? rawQuiz.questions : [];
    if (!rawQuiz || rawQuestions.length === 0) {
      throw new Error(`Lesson ${lessonIndex + 1} is missing quiz questions.`);
    }

    const questions = rawQuestions.slice(0, input.questionsPerLesson).map((questionValue, questionIndex) => {
      const questionRecord = asObject(questionValue);
      if (!questionRecord) {
        throw new Error(`Lesson ${lessonIndex + 1}, question ${questionIndex + 1} is malformed.`);
      }

      return {
        prompt: asString(questionRecord.prompt, 1000),
        questionType: "single_choice" as const,
        explanation: asString(questionRecord.explanation, 1000),
        xp: clampInteger(Number(questionRecord.xp ?? 5), 1, 20),
        options: normalizeQuestionOptions(questionRecord.options),
      };
    });

    const rawMediaBriefs = Array.isArray(lessonRecord.mediaBriefs) ? lessonRecord.mediaBriefs : [];
    const mediaBriefs = rawMediaBriefs.slice(0, 6).map((briefValue) => {
      const briefRecord = asObject(briefValue) ?? {};
      const assetType = asString(briefRecord.assetType, 40) as AiGeneratorAssetType;
      return {
        assetType: ["image", "audio", "video", "infographic", "thumbnail", "cover"].includes(assetType)
          ? assetType
          : "image",
        placement: asString(briefRecord.placement, 180),
        prompt: asString(briefRecord.prompt, 2000),
        script: asString(briefRecord.script, 4000),
        altText: asString(briefRecord.altText, 240),
        caption: asString(briefRecord.caption, 500),
      };
    }).filter((brief) => brief.placement && brief.prompt);

    if (mediaBriefs.length === 0) {
      mediaBriefs.push({
        assetType: "image",
        placement: "lesson_intro",
        prompt: `Warm, culturally neutral illustration that supports the lesson "${asString(lessonRecord.title, 160)}".`,
        script: "",
        altText: `${asString(lessonRecord.title, 160)} illustration`,
        caption: asString(lessonRecord.title, 160),
      });
    }

    const lessonTitle = asString(lessonRecord.title, 160);
    const lessonDescription = asString(lessonRecord.description, 1000);

    if (!lessonTitle || !lessonDescription) {
      throw new Error(`Lesson ${lessonIndex + 1} is missing a title or description.`);
    }

    return {
      title: lessonTitle,
      description: lessonDescription,
      estimatedMinutes: clampInteger(Number(lessonRecord.estimatedMinutes ?? 10), 3, 90),
      pages,
      quiz: {
        title: asString(rawQuiz.title, 180) || `${lessonTitle} Quiz`,
        questions,
      },
      mediaBriefs,
    };
  });

  const course = {
    title: asString(rawCourse.title, 160),
    description: asString(rawCourse.description, 1000),
    category: asString(rawCourse.category, 120) || "Values Education",
    level: (["beginner", "intermediate", "advanced"].includes(asString(rawCourse.level, 40))
      ? asString(rawCourse.level, 40)
      : input.difficulty) as AiGeneratorLevel,
    estimatedMinutes: clampInteger(
      Number(rawCourse.estimatedMinutes ?? lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0)),
      5,
      600,
    ),
  };

  if (!course.title || !course.description) {
    throw new Error("The AI response is missing the course title or description.");
  }

  return {
    course,
    lessons,
  };
}

export function clampAiGenerationRequest(input: AiCourseGenerationInput): AiCourseGenerationInput {
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

export function getAiLearningConfig() {
  return {
    textModel: DEFAULT_TEXT_MODEL,
    reviewModel: DEFAULT_REVIEW_MODEL,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  };
}

export async function generateAiCourseDraft(
  rawInput: AiCourseGenerationInput,
): Promise<AiGeneratedCourseDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to the server environment before generating AI drafts.");
  }

  const input = clampAiGenerationRequest(rawInput);
  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new Error("Topic, target audience, country or region, and tone are required.");
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
              text: "You create safe educational course drafts. Return strict JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(input),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "learning_course_draft",
          schema: RESPONSE_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const apiError = asObject(payload.error);
    const message = asString(apiError?.message, 500) || "The AI provider rejected the course draft request.";
    throw new Error(message);
  }

  const rawText = extractResponseText(payload);
  if (!rawText) {
    throw new Error("The AI provider returned an empty response for the course draft.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("The AI provider returned invalid JSON for the course draft.");
  }

  return normalizeDraftShape(parsed, input);
}
