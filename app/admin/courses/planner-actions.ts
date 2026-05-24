"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import {
  generateCourseExpansionPlans,
  generateNewCoursePlans,
  parseStoredCourseExpansionPlan,
  parseStoredNewCoursePlan,
  parseStoredNewCoursePlanSelection,
  type CourseExpansionContext,
  type CourseExpansionGoal,
  type CourseExpansionPlanResult,
  type CourseExpansionSuggestion,
  type NewCoursePlanInput,
  type NewCoursePlanOption,
  type PlannerLevel,
  type StoredNewCoursePlanSelection,
} from "@/lib/ai-course-planner";
import { requireAdmin } from "@/lib/admin";
import { getAiLearningConfig } from "@/lib/ai-learning-generator";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import {
  extendCourseWithAiLessons,
  generateAiCourseDraft,
} from "@/app/admin/courses/ai-actions";

type PlannerCourseRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: PlannerLevel;
};

type PlannerLessonRow = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type PlannerPageRow = {
  id: string;
  lesson_id: string;
  page_number: number;
  title: string;
  subtitle: string | null;
  page_type: string;
};

type PlannerBlockRow = {
  page_id: string;
  block_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

type PlannerQuizRow = {
  id: string;
  lesson_id: string;
  title: string;
};

type PlannerQuestionRow = {
  quiz_id: string;
  question_order: number;
  prompt: string;
  explanation: string | null;
};

type PlannerPlanRow = {
  id: string;
  mode: string;
  course_id: string | null;
  status: string;
  generated_plan: Record<string, unknown>;
  selected_items: unknown[];
};

const EXPANSION_GOALS: CourseExpansionGoal[] = [
  "Add beginner lessons",
  "Add advanced lessons",
  "Add scenario/practice lessons",
  "Add recap/assessment lesson",
  "Fill topic gaps",
  "Improve weak course progression",
  "Create follow-up course",
];

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return sanitizePlainTextInput(value, maxLength).trim();
}

function parseInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function getRecommendedQuestionCount(level: PlannerLevel) {
  if (level === "advanced") return 9;
  if (level === "intermediate") return 8;
  return 7;
}

function slugify(value: string) {
  return sanitizePlainTextInput(value, 160)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function createTextId(prefix: string, value: string) {
  return `${prefix}-${slugify(value)}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
}

function buildUrl(pathname: string, params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function revalidatePlannerPaths(courseId?: string | null) {
  revalidatePath("/admin/courses");
  revalidatePath("/admin/courses/ai/planner");
  if (courseId) {
    revalidatePath(`/admin/courses/${courseId}`);
  }
}

function parseNewCoursePlanInput(formData: FormData): NewCoursePlanInput {
  const levelRaw = String(formData.get("level") ?? "beginner");
  const level: PlannerLevel =
    levelRaw === "advanced" ? "advanced" : levelRaw === "intermediate" ? "intermediate" : "beginner";

  return {
    roughIdea: asString(formData.get("roughIdea"), 500),
    audience: asString(formData.get("audience"), 200),
    region: asString(formData.get("region"), 120),
    level,
    tone: asString(formData.get("tone"), 120),
    notes: asString(formData.get("notes"), 2000),
  };
}

function parseExpansionGoal(formData: FormData): CourseExpansionGoal {
  const goal = asString(formData.get("expansion_goal"), 120);
  return EXPANSION_GOALS.find((value) => value === goal) ?? "Fill topic gaps";
}

function parseJsonArray<T>(value: FormDataEntryValue | null, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]")) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function getSelectedNewCoursePlanSelection(plan: PlannerPlanRow) {
  const [firstItem] = Array.isArray(plan.selected_items) ? plan.selected_items : [];
  return parseStoredNewCoursePlanSelection(firstItem);
}

function buildSelectedPlanSelection(
  option: NewCoursePlanOption,
  patch: Partial<StoredNewCoursePlanSelection> = {},
): StoredNewCoursePlanSelection {
  return {
    ...option,
    ...patch,
  };
}

function summarizeBlock(block: PlannerBlockRow) {
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

async function getCourseExpansionContext(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
  expansionGoal: CourseExpansionGoal,
  numberOfSuggestions: number,
  notes: string,
) {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title, description, category, level")
    .eq("id", courseId)
    .maybeSingle<PlannerCourseRow>();

  if (courseError) throw courseError;
  if (!course) {
    throw new Error("Course not found.");
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, title, description, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<PlannerLessonRow[]>();

  if (lessonsError) throw lessonsError;

  const lessonIds = (lessons ?? []).map((lesson) => lesson.id);
  let pages: PlannerPageRow[] = [];
  let blocks: PlannerBlockRow[] = [];
  let quizzes: PlannerQuizRow[] = [];
  let questions: PlannerQuestionRow[] = [];

  if (lessonIds.length > 0) {
    const [pagesResult, quizzesResult] = await Promise.all([
      supabase
        .from("lesson_pages")
        .select("id, lesson_id, page_number, title, subtitle, page_type")
        .in("lesson_id", lessonIds)
        .order("page_number", { ascending: true })
        .returns<PlannerPageRow[]>(),
      supabase
        .from("quizzes")
        .select("id, lesson_id, title")
        .in("lesson_id", lessonIds)
        .returns<PlannerQuizRow[]>(),
    ]);

    if (pagesResult.error) throw pagesResult.error;
    if (quizzesResult.error) throw quizzesResult.error;
    pages = pagesResult.data ?? [];
    quizzes = quizzesResult.data ?? [];

    const pageIds = pages.map((page) => page.id);
    const quizIds = quizzes.map((quiz) => quiz.id);

    if (pageIds.length > 0) {
      const { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("page_id, block_type, sort_order, payload")
        .in("page_id", pageIds)
        .order("sort_order", { ascending: true })
        .returns<PlannerBlockRow[]>();

      if (error) throw error;
      blocks = data ?? [];
    }

    if (quizIds.length > 0) {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("quiz_id, question_order, prompt, explanation")
        .in("quiz_id", quizIds)
        .order("question_order", { ascending: true })
        .returns<PlannerQuestionRow[]>();

      if (error) throw error;
      questions = data ?? [];
    }
  }

  const blocksByPageId = new Map<string, PlannerBlockRow[]>();
  for (const block of blocks) {
    const current = blocksByPageId.get(block.page_id) ?? [];
    current.push(block);
    blocksByPageId.set(block.page_id, current);
  }

  const pagesByLessonId = new Map<string, PlannerPageRow[]>();
  for (const page of pages) {
    const current = pagesByLessonId.get(page.lesson_id) ?? [];
    current.push(page);
    pagesByLessonId.set(page.lesson_id, current);
  }

  const quizzesByLessonId = new Map<string, PlannerQuizRow>();
  for (const quiz of quizzes) {
    quizzesByLessonId.set(quiz.lesson_id, quiz);
  }

  const questionsByQuizId = new Map<string, PlannerQuestionRow[]>();
  for (const question of questions) {
    const current = questionsByQuizId.get(question.quiz_id) ?? [];
    current.push(question);
    questionsByQuizId.set(question.quiz_id, current);
  }

  const existingLessons = (lessons ?? []).map((lesson) => {
    const lessonPages = (pagesByLessonId.get(lesson.id) ?? []).map((page) => {
      const blockSummary = (blocksByPageId.get(page.id) ?? [])
        .slice(0, 3)
        .map(summarizeBlock)
        .filter(Boolean)
        .join(" ");
      const summaryParts = [
        page.subtitle ? asString(page.subtitle, 160) : "",
        blockSummary,
      ].filter(Boolean);

      return {
        title: page.title,
        pageType: page.page_type,
        summary: summaryParts.join(" ").slice(0, 500) || "No summary available.",
      };
    });

    const quiz = quizzesByLessonId.get(lesson.id);
    const quizQuestions = quiz ? questionsByQuizId.get(quiz.id) ?? [] : [];
    const quizSummary = quiz
      ? [
          quiz.title,
          `${quizQuestions.length} question${quizQuestions.length === 1 ? "" : "s"}`,
          quizQuestions.slice(0, 3).map((question) => asString(question.prompt, 160)).filter(Boolean).join(" | "),
        ]
          .filter(Boolean)
          .join(". ")
      : "No quiz yet.";

    return {
      title: lesson.title,
      description: asString(lesson.description ?? "", 1000),
      pages: lessonPages,
      quizSummary: quizSummary.slice(0, 800),
    };
  });

  const context: CourseExpansionContext = {
    courseId: course.id,
    courseTitle: course.title,
    courseDescription: course.description,
    courseCategory: course.category,
    courseLevel: course.level,
    existingLessons,
    expansionGoal,
    numberOfSuggestions,
    notes,
  };

  return context;
}

async function getPlannerPlan(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  planId: string,
) {
  const { data, error } = await supabase
    .from("ai_course_plans")
    .select("id, mode, course_id, status, generated_plan, selected_items")
    .eq("id", planId)
    .maybeSingle<PlannerPlanRow>();

  if (error) throw error;
  if (!data) {
    throw new Error("Planner record not found.");
  }

  return {
    ...data,
    selected_items: Array.isArray(data.selected_items) ? data.selected_items : [],
  };
}

function mergeNewCourseOptionEdits(
  formData: FormData,
  baseOption: NewCoursePlanOption,
): NewCoursePlanOption {
  const learningObjectives = parseJsonArray<string>(
    formData.get("learningObjectivesJson"),
    baseOption.learningObjectives,
  )
    .map((item) => asString(item, 240))
    .filter(Boolean);
  const lessonOutline = parseJsonArray<NewCoursePlanOption["lessonOutline"][number]>(
    formData.get("lessonOutlineJson"),
    baseOption.lessonOutline,
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

function buildSelectedCourseNotes(input: NewCoursePlanInput, option: NewCoursePlanOption) {
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

function buildCourseShellGenerationNotes(input: NewCoursePlanInput, option: NewCoursePlanOption, planId: string) {
  const config = getAiLearningConfig();
  return {
    source: "openai",
    mode: "planner_course_shell",
    plannerPlanId: planId,
    plannerStage: "course_shell",
    textModel: config.textModel,
    reviewModel: config.reviewModel,
    generatedFrom: {
      topic: option.title || input.roughIdea,
      audience: option.targetAudience || input.audience,
      region: input.region,
      difficulty: option.level,
      tone: option.tone || input.tone,
      notes: buildSelectedCourseNotes(input, option),
    },
    selectedBrief: option,
    lessonCount: option.lessonOutline.length,
  };
}

function buildPlannedLessonsNotes(input: NewCoursePlanInput, option: NewCoursePlanOption) {
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

function buildPlannedLessonsContinuityInstruction(option: NewCoursePlanOption) {
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

function buildExpansionDraftNotes(
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

function buildExpansionContinuityInstruction(
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

export async function generateNewCoursePlanOptions(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const input = parseNewCoursePlanInput(formData);

  if (!input.roughIdea || !input.audience || !input.region || !input.tone) {
    throw new Error("Rough idea, audience, region, and tone are required.");
  }

  const result = await generateNewCoursePlans(input);
  const { data, error } = await supabase
    .from("ai_course_plans")
    .insert({
      mode: "new_course",
      course_id: null,
      status: "draft",
      input_prompt: [
        `Rough idea: ${input.roughIdea}`,
        `Audience: ${input.audience}`,
        `Region: ${input.region}`,
        `Level: ${input.level}`,
        `Tone: ${input.tone}`,
        input.notes ? `Notes: ${input.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      generated_plan: {
        input,
        result,
      },
      selected_items: [],
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throw error;

  revalidatePlannerPaths();
  redirect(
    appendAdminNotice(
      buildUrl("/admin/courses/ai/planner", { plan: data.id }),
      "Three AI course brief options are ready.",
    ),
  );
}

export async function generateCourseExpansionPlan(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = asString(formData.get("course_id"), 120);
  const expansionGoal = parseExpansionGoal(formData);
  const numberOfSuggestions = clampInteger(parseInteger(formData.get("number_of_suggestions"), 3), 1, 6);
  const notes = asString(formData.get("notes"), 2000);

  if (!courseId) {
    throw new Error("Select a course to expand.");
  }

  const context = await getCourseExpansionContext(
    supabase,
    courseId,
    expansionGoal,
    numberOfSuggestions,
    notes,
  );
  const result = await generateCourseExpansionPlans(context);

  const { data, error } = await supabase
    .from("ai_course_plans")
    .insert({
      mode: "expand_course",
      course_id: courseId,
      status: "draft",
      input_prompt: [
        `Course: ${context.courseTitle}`,
        `Expansion goal: ${context.expansionGoal}`,
        `Suggestions requested: ${context.numberOfSuggestions}`,
        notes ? `Notes: ${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      generated_plan: {
        input: context,
        result,
      },
      selected_items: [],
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throw error;

  revalidatePlannerPaths(courseId);
  redirect(
    appendAdminNotice(
      buildUrl("/admin/courses/ai/planner", { courseId, plan: data.id }),
      "AI expansion suggestions are ready.",
    ),
  );
}

export async function selectCoursePlanOption(formData: FormData) {
  const { supabase } = await requireAdmin();
  const planId = asString(formData.get("planId"), 120);
  const optionIndex = parseInteger(formData.get("optionIndex"), 0);
  const suggestionIndex = parseInteger(formData.get("suggestionIndex"), -1);
  const redirectTo = asString(
    formData.get("redirectTo"),
    400,
    "/admin/courses/ai/planner",
  );

  const plan = await getPlannerPlan(supabase, planId);

  if (plan.mode === "new_course") {
    const stored = parseStoredNewCoursePlan(plan.generated_plan);
    if (!stored) {
      throw new Error("The saved course brief is invalid.");
    }

    const baseOption = stored.result.options[optionIndex];
    if (!baseOption) {
      throw new Error("Selected brief option not found.");
    }

    const selectedOption = mergeNewCourseOptionEdits(formData, baseOption);
    const { error } = await supabase
      .from("ai_course_plans")
      .update({
        status: "selected",
        selected_items: [selectedOption],
      })
      .eq("id", planId);

    if (error) throw error;

    revalidatePlannerPaths(plan.course_id);
    redirect(appendAdminNotice(redirectTo, "Course brief saved for drafting."));
  }

  const stored = parseStoredCourseExpansionPlan(plan.generated_plan);
  if (!stored) {
    throw new Error("The saved expansion plan is invalid.");
  }

  const suggestion = stored.result.lessonSuggestions[suggestionIndex];
  if (!suggestion) {
    throw new Error("Selected lesson suggestion not found.");
  }

  const existingSelections = Array.isArray(plan.selected_items) ? plan.selected_items : [];
  const nextSelections = [...existingSelections, suggestion];
  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "selected",
      selected_items: nextSelections,
    })
    .eq("id", planId);

  if (error) throw error;

  revalidatePlannerPaths(plan.course_id);
  redirect(appendAdminNotice(redirectTo, "Lesson suggestion saved."));
}

function getSelectedNewCourseOptionFromForm(
  plan: PlannerPlanRow,
  formData: FormData,
) {
  const optionIndex = parseInteger(formData.get("optionIndex"), 0);
  const stored = parseStoredNewCoursePlan(plan.generated_plan);

  if (!stored) {
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

export async function handleNewCoursePlanOptionSubmission(formData: FormData) {
  const submitIntent = asString(formData.get("submitIntent"), 40);

  if (submitIntent === "use-brief") {
    const { supabase } = await requireAdmin();
    const planId = asString(formData.get("planId"), 120);
    const redirectTo = asString(
      formData.get("redirectTo"),
      400,
      "/admin/courses/ai/planner",
    );
    const plan = await getPlannerPlan(supabase, planId);

    if (plan.mode !== "new_course") {
      throw new Error("This action only supports new course plans.");
    }

    const { selectedOption } = getSelectedNewCourseOptionFromForm(plan, formData);
    const { error } = await supabase
      .from("ai_course_plans")
      .update({
        status: "selected",
        selected_items: [selectedOption],
      })
      .eq("id", planId);

    if (error) throw error;

    revalidatePlannerPaths(plan.course_id);
    redirect(appendAdminNotice(redirectTo, "Course brief saved for drafting."));
  }

  if (submitIntent === "generate-course") {
    await generateCourseFromSelectedPlan(formData);
    return;
  }

  if (submitIntent === "generate-course-shell") {
    await generateCourseShellFromSelectedPlan(formData);
    return;
  }

  throw new Error("Unsupported planner action.");
}

export async function dismissCoursePlan(formData: FormData) {
  const { supabase } = await requireAdmin();
  const planId = asString(formData.get("planId"), 120);
  const redirectTo = asString(
    formData.get("redirectTo"),
    400,
    "/admin/courses/ai/planner",
  );
  const plan = await getPlannerPlan(supabase, planId);

  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "dismissed",
      selected_items: [],
    })
    .eq("id", planId);

  if (error) throw error;

  revalidatePlannerPaths(plan.course_id);
  redirect(appendAdminNotice(redirectTo, "Planner result dismissed."));
}

export async function generateCourseFromSelectedPlan(formData: FormData) {
  const { supabase } = await requireAdmin();
  const planId = asString(formData.get("planId"), 120);
  const plan = await getPlannerPlan(supabase, planId);
  const { stored, selectedOption } = getSelectedNewCourseOptionFromForm(plan, formData);
  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "used",
      selected_items: [selectedOption],
    })
    .eq("id", planId);

  if (error) throw error;

  revalidatePlannerPaths();

  const draftFormData = new FormData();
  draftFormData.set("topic", selectedOption.title || stored.input.roughIdea);
  draftFormData.set("audience", selectedOption.targetAudience || stored.input.audience);
  draftFormData.set("region", stored.input.region);
  draftFormData.set("difficulty", selectedOption.level);
  draftFormData.set("tone", selectedOption.tone || stored.input.tone);
  draftFormData.set("lessonCount", String(clampInteger(selectedOption.lessonOutline.length, 1, 8)));
  draftFormData.set("questionsPerLesson", String(getRecommendedQuestionCount(selectedOption.level)));
  draftFormData.set("notes", buildSelectedCourseNotes(stored.input, selectedOption));

  await generateAiCourseDraft(draftFormData);
}

export async function generateCourseShellFromSelectedPlan(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const planId = asString(formData.get("planId"), 120);
  const plan = await getPlannerPlan(supabase, planId);

  if (plan.mode !== "new_course") {
    throw new Error("This action only supports new course plans.");
  }

  const { stored, selectedOption } = getSelectedNewCourseOptionFromForm(plan, formData);
  const existingSelection = getSelectedNewCoursePlanSelection(plan);

  if (existingSelection?.generatedCourseId) {
    revalidatePlannerPaths(existingSelection.generatedCourseId);
    redirect(
      appendAdminNotice(
        `/admin/courses/${existingSelection.generatedCourseId}`,
        "This planner brief already has a generated course shell.",
      ),
    );
  }

  const courseId = createTextId("course", selectedOption.title || stored.input.roughIdea);
  const courseSlug = `${slugify(selectedOption.title || stored.input.roughIdea)}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
  const now = new Date().toISOString();
  const courseRow = {
    id: courseId,
    slug: courseSlug,
    title: selectedOption.title,
    description: selectedOption.description,
    category: "Values Education",
    level: selectedOption.level,
    thumbnail: {},
    status: "draft",
    sort_order: 0,
    estimated_minutes: 0,
    ai_text_status: "draft",
    ai_media_status: "not_started",
    ai_publish_status: "not_ready",
    ai_generated: true,
    ai_generation_notes: buildCourseShellGenerationNotes(stored.input, selectedOption, planId),
  };

  const mediaRows = [
    {
      course_id: courseId,
      lesson_id: null,
      asset_type: "cover",
      placement: "course_cover",
      source: "ai_generated",
      prompt: `${selectedOption.mediaStyle}. Course cover for "${selectedOption.title}". ${selectedOption.description}`,
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${selectedOption.title} course cover illustration`,
      caption: selectedOption.title,
      metadata: {
        plannerPlanId: planId,
        required: false,
        targetKind: "course_cover",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: 0,
    },
    {
      course_id: courseId,
      lesson_id: null,
      asset_type: "thumbnail",
      placement: "course_thumbnail",
      source: "ai_generated",
      prompt: `${selectedOption.mediaStyle}. Mobile-friendly course thumbnail for "${selectedOption.title}". ${selectedOption.description}`,
      script: "",
      url: null,
      storage_path: null,
      provider: null,
      model: null,
      alt_text: `${selectedOption.title} course thumbnail`,
      caption: selectedOption.title,
      metadata: {
        plannerPlanId: planId,
        required: true,
        targetKind: "course_thumbnail",
      },
      review_status: "draft",
      generation_status: "pending",
      generation_error: null,
      sort_order: 1,
    },
  ];

  try {
    const { error: courseError } = await supabase.from("courses").insert(courseRow);
    if (courseError) throw courseError;

    const { error: mediaError } = await supabase.from("learning_media_assets").insert(mediaRows);
    if (mediaError) throw mediaError;

    const { error: auditError } = await supabase.from("audit_events").insert({
      actor_user_id: profile.id,
      event_type: "ai_course_shell_generated",
      entity_type: "course",
      entity_id: courseId,
      metadata: {
        plannerPlanId: planId,
        selectedBriefTitle: selectedOption.title,
        lessonCountPlanned: selectedOption.lessonOutline.length,
      },
    });
    if (auditError) throw auditError;

    const nextSelection = buildSelectedPlanSelection(selectedOption, {
      generatedCourseId: courseId,
      courseShellCreatedAt: now,
    });
    const { error: planError } = await supabase
      .from("ai_course_plans")
      .update({
        status: "selected",
        course_id: courseId,
        selected_items: [nextSelection],
      })
      .eq("id", planId);

    if (planError) throw planError;
  } catch (error) {
    try {
      await supabase.from("courses").delete().eq("id", courseId);
    } catch {
      // Ignore cleanup failures so the original shell-generation error still surfaces.
    }
    throw error;
  }

  revalidatePlannerPaths(courseId);
  redirect(
    appendAdminNotice(
      `/admin/courses/${courseId}`,
      "AI course shell created. Review the course, generate course media, and enable it when ready. Generate lessons later from the planner.",
    ),
  );
}

export async function generatePlannedLessonsFromSelectedPlan(formData: FormData) {
  const { supabase } = await requireAdmin();
  const planId = asString(formData.get("planId"), 120);
  const plan = await getPlannerPlan(supabase, planId);

  if (plan.mode !== "new_course") {
    throw new Error("This action only supports new course plans.");
  }

  const stored = parseStoredNewCoursePlan(plan.generated_plan);
  if (!stored) {
    throw new Error("The saved course brief is invalid.");
  }

  const selectedOption = getSelectedNewCoursePlanSelection(plan);
  if (!selectedOption) {
    throw new Error("Select or generate a course brief before generating planned lessons.");
  }

  if (!selectedOption.generatedCourseId) {
    throw new Error("Generate the course shell first before drafting the planned lessons.");
  }

  if (selectedOption.lessonsGeneratedAt) {
    revalidatePlannerPaths(selectedOption.generatedCourseId);
    redirect(
      appendAdminNotice(
        `/admin/courses/${selectedOption.generatedCourseId}`,
        "Planned lessons were already generated for this course shell.",
      ),
    );
  }

  const { data: existingLessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", selectedOption.generatedCourseId)
    .limit(1);

  if (lessonsError) throw lessonsError;
  if ((existingLessons ?? []).length > 0) {
    throw new Error("This course already has lessons. Use the expansion planner for additional lesson drafts.");
  }

  const nextSelection = buildSelectedPlanSelection(selectedOption, {
    lessonsGeneratedAt: new Date().toISOString(),
    lessonsGeneratedCount: selectedOption.lessonOutline.length,
  });
  const { error: planError } = await supabase
    .from("ai_course_plans")
    .update({
      status: "used",
      course_id: selectedOption.generatedCourseId,
      selected_items: [nextSelection],
    })
    .eq("id", planId);

  if (planError) throw planError;

  revalidatePlannerPaths(selectedOption.generatedCourseId);

  const draftFormData = new FormData();
  draftFormData.set("courseId", selectedOption.generatedCourseId);
  draftFormData.set("topic", selectedOption.title || stored.input.roughIdea);
  draftFormData.set("audience", selectedOption.targetAudience || stored.input.audience);
  draftFormData.set("region", stored.input.region);
  draftFormData.set("difficulty", selectedOption.level);
  draftFormData.set("tone", selectedOption.tone || stored.input.tone);
  draftFormData.set("lessonCount", String(clampInteger(selectedOption.lessonOutline.length, 1, 10)));
  draftFormData.set("questionsPerLesson", String(getRecommendedQuestionCount(selectedOption.level)));
  draftFormData.set("notes", buildPlannedLessonsNotes(stored.input, selectedOption));
  draftFormData.set("continuityInstruction", buildPlannedLessonsContinuityInstruction(selectedOption));

  await extendCourseWithAiLessons(draftFormData);
}

export async function generateLessonFromExpansionSuggestion(formData: FormData) {
  const { supabase } = await requireAdmin();
  const planId = asString(formData.get("planId"), 120);
  const suggestionIndex = parseInteger(formData.get("suggestionIndex"), 0);
  const plan = await getPlannerPlan(supabase, planId);
  const stored = parseStoredCourseExpansionPlan(plan.generated_plan);

  if (!stored) {
    throw new Error("The saved expansion plan is invalid.");
  }

  const suggestion = stored.result.lessonSuggestions[suggestionIndex];
  if (!suggestion) {
    throw new Error("Selected lesson suggestion not found.");
  }

  const { error } = await supabase
    .from("ai_course_plans")
    .update({
      status: "used",
      selected_items: [suggestion],
    })
    .eq("id", planId);

  if (error) throw error;

  revalidatePlannerPaths(stored.input.courseId);

  const draftFormData = new FormData();
  draftFormData.set("courseId", stored.input.courseId);
  draftFormData.set("topic", suggestion.title);
  draftFormData.set("audience", `Learners continuing the course "${stored.input.courseTitle}"`);
  draftFormData.set("region", "Current course context");
  draftFormData.set("difficulty", suggestion.difficulty);
  draftFormData.set("tone", "clear, practical, encouraging");
  draftFormData.set("lessonCount", "1");
  draftFormData.set("questionsPerLesson", String(getRecommendedQuestionCount(suggestion.difficulty)));
  draftFormData.set(
    "notes",
    buildExpansionDraftNotes(
      stored.input.courseTitle,
      suggestion,
      stored.result.courseAnalysis,
      stored.input.notes ?? "",
    ),
  );
  draftFormData.set(
    "continuityInstruction",
    buildExpansionContinuityInstruction(stored.input.courseTitle, suggestion, stored.input.notes ?? ""),
  );

  await extendCourseWithAiLessons(draftFormData);
}
