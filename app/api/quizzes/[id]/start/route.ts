import { NextResponse } from "next/server";
import {
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { startSupabaseQuizAttempt } from "@/lib/supabase-quiz";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isDemoMode } from "@/lib/app-mode";
import { startQuizAttempt } from "@/lib/demo-progress-store";

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
  const lessonId = getStringField(bodyResult.data, "lessonId", issues);
  const programmeId = getStringField(bodyResult.data, "programmeId", issues, { required: false });

  if (issues.length > 0 || !lessonId) {
    return validationErrorResponse(issues);
  }

  const supabase = await createSupabaseServerClient();

  if (isDemoMode) {
    const result = startQuizAttempt(lessonId, id);
    const status = result.status === "blocked" ? 403 : 200;
    return NextResponse.json(result, { status });
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Quiz attempts are unavailable until the live backend is configured." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        status: "blocked",
        reason: "lesson_incomplete",
        message: "Create an account or log in to take quizzes and save XP.",
      },
      { status: 403 },
    );
  }

  try {
    const result = await startSupabaseQuizAttempt({
      supabase,
      userId: user.id,
      lessonId,
      quizId: id,
      programmeId,
    });
    const status = result.status === "blocked" ? 403 : 200;

    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start quiz." },
      { status: 500 },
    );
  }
}
