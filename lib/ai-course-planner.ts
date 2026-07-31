import "server-only";

import {
  MAX_COURSE_DESCRIPTION_LENGTH,
  MAX_COURSE_TITLE_LENGTH,
  asObject,
  asString,
  normalizeCourseExpansionContext,
  normalizeCourseExpansionPlanResult,
  normalizeNewCoursePlanInput,
  normalizeNewCoursePlanResult,
  type CourseExpansionContext,
  type CourseExpansionPlanResult,
  type NewCoursePlanInput,
  type NewCoursePlanResult,
} from "@/features/learning/admin/planner-model";

export {
  normalizeCourseExpansionContext,
  normalizeNewCoursePlanInput,
  parseStoredCourseExpansionPlan,
  parseStoredNewCoursePlan,
  parseStoredNewCoursePlanSelection,
  type CourseExpansionContext,
  type CourseExpansionGoal,
  type CourseExpansionPlanResult,
  type CourseExpansionSuggestion,
  type NewCoursePlanInput,
  type NewCoursePlanOption,
  type NewCoursePlanResult,
  type PlannerAssetType,
  type PlannerLevel,
  type PlannerPageType,
  type StoredCourseExpansionPlan,
  type StoredNewCoursePlan,
  type StoredNewCoursePlanSelection,
} from "@/features/learning/admin/planner-model";

const DEFAULT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.4-mini";

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
