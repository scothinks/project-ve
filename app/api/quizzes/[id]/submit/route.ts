import { NextResponse } from "next/server";
import { getQuizXP } from "@/lib/lessons";
import { getLearningQuiz } from "@/lib/supabase-learning";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type QuizSubmission = {
  answers?: Array<{
    questionId?: string;
    selectedOptionIds?: string[];
  }>;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const detail = await getLearningQuiz(supabase, id);
  const quiz = detail?.quiz;

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const body = (await request.json()) as QuizSubmission;
  const answers = body.answers ?? [];
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
