import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  materializeAiCourseTextJob,
  type AiGenerationClaim,
} from "@/features/ai-generation/data/jobs";
import { getLessonWorkflowData } from "@/features/ai-generation/data/workflow";
import {
  buildGeneratedQuizQuestionRows,
  ensureNoDuplicateQuizQuestionPrompt,
} from "@/features/ai-generation/domain/generated-tree";
import { getPromptString } from "@/features/ai-generation/application/job-prompts";
import {
  generateAiQuizQuestion,
  type AiGeneratorLevel,
} from "@/lib/ai-learning-generator";
import { ValidationError } from "@/lib/app-errors";
import type { Database } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

export type QuizQuestionJobResult = {
  courseId: string;
  lessonId: string;
  questionId: string;
  lessonIds: string[];
};

export async function processGenerateQuizQuestionJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  workerId: string,
): Promise<QuizQuestionJobResult> {
  const lessonId = getPromptString(job.prompt, "lessonId");

  if (!lessonId) {
    throw new ValidationError("AI quiz question job is missing a lesson id.");
  }

  const { course, lesson, quiz } = await getLessonWorkflowData(supabase, lessonId);

  if (!quiz) {
    throw new ValidationError("This lesson does not have a quiz yet.");
  }

  const { data: existingQuestionRows, error: existingQuestionsError } = await supabase
    .from("quiz_questions")
    .select("prompt, question_order")
    .eq("quiz_id", quiz.id)
    .order("question_order", { ascending: true });

  if (existingQuestionsError) throw existingQuestionsError;

  const existingQuestions = existingQuestionRows ?? [];
  const generatedQuestion = await generateAiQuizQuestion({
    course: {
      title: course.title,
      category: course.category,
      level: course.level as AiGeneratorLevel,
    },
    lesson: {
      title: lesson.title,
      description: lesson.description ?? "",
    },
    existingQuestions: existingQuestions.map((question) => ({ prompt: question.prompt })),
  });

  ensureNoDuplicateQuizQuestionPrompt(existingQuestions, generatedQuestion.prompt);

  const nextQuestionOrder = existingQuestions.reduce(
    (max, question) => Math.max(max, question.question_order),
    0,
  ) + 1;
  const { questionId, questionRows, optionRows } = buildGeneratedQuizQuestionRows({
    quizId: quiz.id,
    question: generatedQuestion,
    questionOrder: nextQuestionOrder,
  });

  await materializeAiCourseTextJob(supabase, {
    courseRow: null,
    courseUpdate: null,
    entityId: course.id,
    generatedTree: {
      lessonRows: [],
      pageRows: [],
      blockRows: [],
      quizRows: [],
      questionRows,
      optionRows,
      mediaRows: [],
    },
    jobId: job.id,
    jobResult: {
      mode: "generate_quiz_question",
      courseId: course.id,
      lessonId,
      quizId: quiz.id,
      questionId,
      generatedQuestion,
    },
    workerId,
    lockToken: job.lock_token,
    lockVersion: job.lock_version,
  });

  return {
    courseId: course.id,
    lessonId,
    questionId,
    lessonIds: [lessonId],
  };
}
