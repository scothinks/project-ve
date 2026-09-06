import { NextResponse } from "next/server";
import { revalidateLearningPaths } from "@/app/admin/courses/learning-cache";
import { requireAdmin } from "@/lib/admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    const parsed = await request.json();
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const courseId = cleanText(payload.courseId);
  const lessonId = cleanText(payload.lessonId);

  if (!courseId || !lessonId) {
    return NextResponse.json({ error: "Course and lesson are required." }, { status: 400 });
  }

  const { supabase } = await requireAdmin();
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_id, title, description, cover_image, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (lessonError) {
    return NextResponse.json({ error: lessonError.message }, { status: 500 });
  }

  if (!lessonData) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const { error } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: lessonData.id,
    p_course_id: lessonData.course_id,
    p_title: lessonData.title,
    p_description: lessonData.description ?? "",
    p_cover_image: lessonData.cover_image ?? {},
    p_status: "archived",
    p_sort_order: lessonData.sort_order,
    p_estimated_minutes: lessonData.estimated_minutes,
    p_retry_mode: lessonData.retry_mode,
    p_retry_cooldown_seconds: lessonData.retry_cooldown_seconds,
    p_retry_requires_reread: lessonData.retry_requires_reread,
    p_quiz_requires_lesson_completion: lessonData.quiz_requires_lesson_completion,
    p_max_earning_attempts: lessonData.max_earning_attempts,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: quizError } = await supabase
    .from("quizzes")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("lesson_id", lessonId);

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }

  revalidateLearningPaths(courseId, [lessonId]);

  return NextResponse.json({ status: "archived" });
}
