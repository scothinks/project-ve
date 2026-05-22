import { NextResponse } from "next/server";
import { markLessonPageCompletedInSupabase } from "@/lib/progress";
import { getLearningLesson } from "@/lib/supabase-learning";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type LessonProgressBody = {
  lessonId?: string;
  pageId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LessonProgressBody;

  if (!body.lessonId || !body.pageId) {
    return NextResponse.json({ error: "lessonId and pageId are required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Lesson progress sync is unavailable until the live backend is configured." },
      { status: 503 },
    );
  }

  const detail = await getLearningLesson(supabase, body.lessonId);
  const lesson = detail?.lesson;
  const page = lesson?.pages.find((item) => item.id === body.pageId);

  if (!lesson || !page) {
    return NextResponse.json({ error: "Page not found for lesson" }, { status: 404 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Create an account or log in to save lesson progress." },
      { status: 401 },
    );
  }

  try {
    const progress = await markLessonPageCompletedInSupabase({
      supabase,
      userId: user.id,
      lesson,
      pageId: page.id,
    });

    return NextResponse.json({
      status: "completed",
      lessonId: lesson.id,
      pageId: page.id,
      completedPages: progress.completedPages,
      lessonCompleted: progress.isLessonComplete,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save lesson progress.",
      },
      { status: 500 },
    );
  }
}
