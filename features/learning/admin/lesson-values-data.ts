import "server-only";

import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminContentValueTags, getAdminValueDimensions } from "@/features/content-values/admin/data";

export async function getLessonValuesPageData(supabase: SupabaseClient<Database>, lessonId: string) {
  const [summary, dimensions, tags] = await Promise.all([
    supabase.from("lessons")
      .select("id, title, lesson_pages(count), quizzes(quiz_questions(count))")
      .eq("id", lessonId).maybeSingle(),
    getAdminValueDimensions(supabase),
    getAdminContentValueTags(supabase, "lesson", lessonId),
  ]);
  if (summary.error) throw summary.error;
  if (!summary.data) return null;
  return {
    lesson: { id: summary.data.id, title: summary.data.title },
    pageCount: summary.data.lesson_pages[0]?.count ?? 0,
    questionCount: summary.data.quizzes?.quiz_questions[0]?.count ?? 0,
    dimensions,
    tags,
  };
}
