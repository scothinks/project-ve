import { NextResponse } from "next/server";
import { AppError } from "@/lib/app-errors";
import { getQuizXP } from "@/lib/lessons";
import {
  getArrayField,
  getStringArrayField,
  getStringField,
  isJsonObject,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { getLearningQuiz } from "@/lib/supabase-learning";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type QuizSubmission = {
  answers: Array<{
    questionId: string;
    selectedOptionIds: string[];
  }>;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const rawAnswers = getArrayField(bodyResult.data, "answers", issues, { required: false }) ?? [];
  const answers: QuizSubmission["answers"] = [];

  rawAnswers.forEach((answer, index) => {
    if (!isJsonObject(answer)) {
      issues.push({ path: `answers.${index}`, message: "Expected an object." });
      return;
    }

    const questionId = getStringField(answer, "questionId", issues);
    const selectedOptionIds = getStringArrayField(answer, "selectedOptionIds", issues);

    if (questionId && selectedOptionIds) {
      answers.push({ questionId, selectedOptionIds });
    }
  });

  if (issues.length > 0) {
    return validationErrorResponse(issues);
  }

  const supabase = await createSupabaseServerClient();
  let detail: Awaited<ReturnType<typeof getLearningQuiz>>;

  try {
    detail = await getLearningQuiz(supabase, id);
  } catch (error) {
    return NextResponse.json(
      { error: "Quiz content is temporarily unavailable." },
      { status: error instanceof AppError ? error.status : 503 },
    );
  }

  const quiz = detail?.quiz;

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  return NextResponse.json({
    quizId: quiz.id,
    totalPossibleXp: getQuizXP(quiz),
    earnedXp: 0,
    correctCount: 0,
    wrongCount: quiz.questions.length,
    questions: answers.map((answer) => ({
      questionId: answer.questionId,
      correct: false,
      earnedXp: 0,
      status: "missed",
    })),
    message: "Use the per-question answer endpoint for rewarded attempts.",
  });
}
