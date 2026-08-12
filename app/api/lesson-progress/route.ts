import { NextResponse } from "next/server";
import { AppError } from "@/lib/app-errors";
import {
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { markLessonPageCompletedInSupabase } from "@/lib/progress";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isDemoMode } from "@/lib/app-mode";
import { markLessonPageCompleted } from "@/lib/demo-progress-store";

export async function POST(request: Request) {
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const lessonId = getStringField(bodyResult.data, "lessonId", issues);
  const organizationId = getStringField(bodyResult.data, "organizationId", issues, { required: false });
  const pageId = getStringField(bodyResult.data, "pageId", issues);
  const programmeId = getStringField(bodyResult.data, "programmeId", issues, { required: false });

  if (issues.length > 0 || !lessonId || !pageId) {
    return validationErrorResponse(issues);
  }

  const supabase = await createSupabaseServerClient();

  if (isDemoMode) {
    try {
      const learningRepository = createLearningRepository(supabase);
      const detail = await learningRepository.getLesson(lessonId);
      const lesson = detail?.lesson;
      const page = lesson?.pages.find((item) => item.id === pageId);

      if (!lesson || !page) {
        return NextResponse.json({ error: "Page not found for lesson" }, { status: 404 });
      }

      markLessonPageCompleted(lesson.id, page.id);

      return NextResponse.json({
        status: "completed",
        lessonId: lesson.id,
        pageId: page.id,
        completedPages: [page.id],
        lessonCompleted: false,
      });
    } catch (error) {
      return NextResponse.json(
        { error: "Lesson content is temporarily unavailable." },
        { status: error instanceof AppError ? error.status : 503 },
      );
    }
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Lesson progress sync is unavailable until the live backend is configured." },
      { status: 503 },
    );
  }

  const learningRepository = createLearningRepository(supabase);

  try {
    const detail = await learningRepository.getLesson(lessonId);
    const lesson = detail?.lesson;
    const page = lesson?.pages.find((item) => item.id === pageId);

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

    const progress = await markLessonPageCompletedInSupabase({
      supabase,
      userId: user.id,
      lesson,
      organizationId,
      pageId: page.id,
      programmeId,
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
      { status: error instanceof AppError ? error.status : 503 },
    );
  }
}
