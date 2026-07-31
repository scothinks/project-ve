import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CourseExpansionContext,
  CourseExpansionGoal,
} from "@/features/learning/admin/planner-model";
import {
  asString,
  summarizeBlock,
  type PlannerBlockRow,
  type PlannerCourseRow,
  type PlannerLessonRow,
  type PlannerPageRow,
  type PlannerPlanRow,
  type PlannerQuestionRow,
  type PlannerQuizRow,
} from "./planner-domain";

export async function getCourseExpansionContext(
  supabase: SupabaseClient,
  courseId: string,
  expansionGoal: CourseExpansionGoal,
  numberOfSuggestions: number,
  notes: string,
) {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title, description, category, level")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) {
    throw new Error("Course not found.");
  }
  const courseRow = course as PlannerCourseRow;

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, title, description, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (lessonsError) throw lessonsError;

  const lessonRows = (lessons ?? []) as PlannerLessonRow[];
  const lessonIds = lessonRows.map((lesson) => lesson.id);
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
        .order("page_number", { ascending: true }),
      supabase
        .from("quizzes")
        .select("id, lesson_id, title")
        .in("lesson_id", lessonIds),
    ]);

    if (pagesResult.error) throw pagesResult.error;
    if (quizzesResult.error) throw quizzesResult.error;
    pages = (pagesResult.data ?? []) as PlannerPageRow[];
    quizzes = (quizzesResult.data ?? []) as PlannerQuizRow[];

    const pageIds = pages.map((page) => page.id);
    const quizIds = quizzes.map((quiz) => quiz.id);

    if (pageIds.length > 0) {
      const { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("page_id, block_type, sort_order, payload")
        .in("page_id", pageIds)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      blocks = (data ?? []) as PlannerBlockRow[];
    }

    if (quizIds.length > 0) {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("quiz_id, question_order, prompt, explanation")
        .in("quiz_id", quizIds)
        .order("question_order", { ascending: true });

      if (error) throw error;
      questions = (data ?? []) as PlannerQuestionRow[];
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

  const existingLessons = lessonRows.map((lesson) => {
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
    courseId: courseRow.id,
    courseTitle: courseRow.title,
    courseDescription: courseRow.description,
    courseCategory: courseRow.category,
    courseLevel: courseRow.level,
    existingLessons,
    expansionGoal,
    numberOfSuggestions,
    notes,
  };

  return context;
}

export async function getPlannerPlan(
  supabase: SupabaseClient,
  planId: string,
) {
  const { data, error } = await supabase
    .from("ai_course_plans")
    .select("id, mode, course_id, status, generated_plan, selected_items")
    .eq("id", planId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Planner record not found.");
  }

  const plan = data as PlannerPlanRow;

  return {
    ...plan,
    selected_items: Array.isArray(plan.selected_items) ? plan.selected_items : [],
  };
}
