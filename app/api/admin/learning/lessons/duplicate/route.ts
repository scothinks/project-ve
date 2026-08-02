import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createCopyId(prefix: string, value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "item";

  return `${prefix}-${slug}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
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
    .select("id, course_id, title, description, cover_image, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (lessonError) {
    return NextResponse.json({ error: lessonError.message }, { status: 500 });
  }

  if (!lessonData) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const { data: lessonOrders, error: lessonOrdersError } = await supabase
    .from("lessons")
    .select("sort_order")
    .eq("course_id", courseId);

  if (lessonOrdersError) {
    return NextResponse.json({ error: lessonOrdersError.message }, { status: 500 });
  }

  const nextSortOrder = ((lessonOrders ?? []) as Array<{ sort_order: number | null }>).reduce(
    (highest, row) => Math.max(highest, row.sort_order ?? 0),
    0,
  ) + 1;

  const { data: newLessonData, error: newLessonError } = await supabase.rpc("admin_upsert_lesson", {
    p_lesson_id: "",
    p_course_id: courseId,
    p_title: `Copy of ${lessonData.title}`,
    p_description: lessonData.description ?? "",
    p_cover_image: lessonData.cover_image ?? {},
    p_status: "draft",
    p_sort_order: nextSortOrder,
    p_estimated_minutes: lessonData.estimated_minutes ?? 0,
    p_retry_mode: lessonData.retry_mode ?? "anytime",
    p_retry_cooldown_seconds: lessonData.retry_cooldown_seconds,
    p_retry_requires_reread: lessonData.retry_requires_reread ?? true,
    p_quiz_requires_lesson_completion: lessonData.quiz_requires_lesson_completion ?? true,
    p_max_earning_attempts: lessonData.max_earning_attempts,
  });

  if (newLessonError) {
    return NextResponse.json({ error: newLessonError.message }, { status: 500 });
  }

  const newLessonId = (newLessonData as { lessonId?: string } | null)?.lessonId;

  if (!newLessonId) {
    return NextResponse.json({ error: "Could not create duplicated lesson." }, { status: 500 });
  }

  const [pagesResult, quizResult] = await Promise.all([
    supabase
      .from("lesson_pages")
      .select("id, page_number, title, subtitle, page_type, cover_image")
      .eq("lesson_id", lessonId)
      .order("page_number", { ascending: true }),
    supabase
      .from("quizzes")
      .select("id, title, version")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
  ]);

  if (pagesResult.error) {
    return NextResponse.json({ error: pagesResult.error.message }, { status: 500 });
  }

  if (quizResult.error) {
    return NextResponse.json({ error: quizResult.error.message }, { status: 500 });
  }

  const pageIdMap = new Map<string, string>();
  const sourcePages = pagesResult.data ?? [];

  for (const page of sourcePages) {
    const newPageId = createCopyId("page", `${newLessonId}-${page.title}`);
    pageIdMap.set(page.id, newPageId);

    const { error } = await supabase.rpc("admin_upsert_lesson_page", {
      p_page_id: newPageId,
      p_lesson_id: newLessonId,
      p_title: page.title,
      p_subtitle: page.subtitle ?? "",
      p_page_type: page.page_type,
      p_page_number: page.page_number,
      p_cover_image: page.cover_image ?? {},
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const sourcePageIds = sourcePages.map((page) => page.id);
  const blocksResult = sourcePageIds.length > 0
    ? await supabase
      .from("lesson_content_blocks")
      .select("page_id, block_type, sort_order, payload")
      .in("page_id", sourcePageIds)
      .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (blocksResult.error) {
    return NextResponse.json({ error: blocksResult.error.message }, { status: 500 });
  }

  for (const block of blocksResult.data ?? []) {
    const newPageId = pageIdMap.get(block.page_id);
    if (!newPageId) continue;

    const { error } = await supabase.rpc("admin_upsert_lesson_block", {
      p_block_id: null,
      p_page_id: newPageId,
      p_block_type: block.block_type,
      p_sort_order: block.sort_order,
      p_payload: block.payload ?? {},
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const sourceQuiz = quizResult.data;
  if (sourceQuiz) {
    const { data: newQuizData, error: quizError } = await supabase
      .from("quizzes")
      .upsert({
        id: `quiz-${newLessonId.replace(/^lesson-/, "")}`,
        lesson_id: newLessonId,
        title: sourceQuiz.title,
        version: sourceQuiz.version,
        status: "draft",
      }, { onConflict: "lesson_id" })
      .select("id")
      .single();

    if (quizError) {
      return NextResponse.json({ error: quizError.message }, { status: 500 });
    }

    const questionsResult = await supabase
      .from("quiz_questions")
      .select("id, question_order, question_type, prompt, explanation, xp")
      .eq("quiz_id", sourceQuiz.id)
      .order("question_order", { ascending: true });

    if (questionsResult.error) {
      return NextResponse.json({ error: questionsResult.error.message }, { status: 500 });
    }

    const questionIds = (questionsResult.data ?? []).map((question) => question.id);
    const optionsResult = questionIds.length > 0
      ? await supabase
        .from("quiz_options")
        .select("question_id, option_order, label, is_correct")
        .in("question_id", questionIds)
        .order("option_order", { ascending: true })
      : { data: [], error: null };

    if (optionsResult.error) {
      return NextResponse.json({ error: optionsResult.error.message }, { status: 500 });
    }

    for (const question of questionsResult.data ?? []) {
      const options = (optionsResult.data ?? [])
        .filter((option) => option.question_id === question.id)
        .map((option) => ({
          isCorrect: option.is_correct,
          label: option.label,
          order: option.option_order,
        }));

      const { error } = await supabase.rpc("admin_upsert_quiz_question", {
        p_question_id: "",
        p_quiz_id: newQuizData.id,
        p_prompt: question.prompt,
        p_question_type: question.question_type,
        p_explanation: question.explanation ?? "",
        p_xp: question.xp,
        p_question_order: question.question_order,
        p_options: options,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ lessonId: newLessonId });
}
