import { NextResponse } from "next/server";
import {
  getStringArrayField,
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { answerSupabaseQuizQuestion } from "@/lib/supabase-quiz";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const attemptId = getStringField(bodyResult.data, "attemptId", issues);
  const questionId = getStringField(bodyResult.data, "questionId", issues);
  const selectedOptionIds = getStringArrayField(bodyResult.data, "selectedOptionIds", issues);

  if (issues.length > 0 || !attemptId || !questionId || !selectedOptionIds) {
    return validationErrorResponse(issues);
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
        attemptId,
        questionId,
        selectedOptionIds,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit answer" },
      { status: 400 },
    );
  }
}
