import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const title = cleanText(payload.title);

  if (!courseId || !title) {
    return NextResponse.json({ error: "Course and lesson title are required." }, { status: 400 });
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: "",
    p_course_id: courseId,
    p_title: title,
    p_description: cleanText(payload.description),
    p_cover_image: {},
    p_status: "draft",
    p_sort_order: Math.max(0, cleanNumber(payload.sortOrder, 0)),
    p_estimated_minutes: Math.max(0, cleanNumber(payload.estimatedMinutes, 0)),
    p_retry_mode: "anytime",
    p_retry_cooldown_seconds: null,
    p_retry_requires_reread: true,
    p_quiz_requires_lesson_completion: true,
    p_max_earning_attempts: null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { lessonId?: string } | null;
  const lessonId = result?.lessonId ?? "";

  if (!lessonId) {
    return NextResponse.json({ error: "The lesson could not be created." }, { status: 500 });
  }

  const { error: syncMinutesError } = await supabase.rpc("admin_sync_course_estimated_minutes", {
    p_course_id: courseId,
  });

  if (syncMinutesError) {
    return NextResponse.json({ error: syncMinutesError.message }, { status: 500 });
  }

  return NextResponse.json({ lessonId });
}
