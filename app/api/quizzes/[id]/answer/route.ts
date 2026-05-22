import { NextResponse } from "next/server";
import { answerSupabaseQuizQuestion } from "@/lib/supabase-quiz";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AnswerQuizBody = {
  attemptId?: string;
  questionId?: string;
  selectedOptionIds?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as AnswerQuizBody;

  if (!body.attemptId || !body.questionId || !Array.isArray(body.selectedOptionIds)) {
    return NextResponse.json(
      { error: "attemptId, questionId and selectedOptionIds are required" },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Quiz answer submission is unavailable until the live backend is configured." },
        { status: 503 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Create an account or log in to submit quiz answers." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      await answerSupabaseQuizQuestion({
        supabase,
        attemptId: body.attemptId,
        questionId: body.questionId,
        selectedOptionIds: body.selectedOptionIds,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit answer" },
      { status: 400 },
    );
  }
}
