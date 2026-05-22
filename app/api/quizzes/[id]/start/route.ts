import { NextResponse } from "next/server";
import { startSupabaseQuizAttempt } from "@/lib/supabase-quiz";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type StartQuizBody = {
  lessonId?: string;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = (await request.json()) as StartQuizBody;

  if (!body.lessonId) {
    return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

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
      lessonId: body.lessonId,
      quizId: id,
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
