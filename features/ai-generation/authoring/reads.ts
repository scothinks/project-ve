import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AuthoringResult, AuthoringResults } from "./contracts";

export async function readAuthoringResult(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase.rpc("admin_read_ai_results", { p_id: id });
  if (error) throw error;
  return data as unknown as AuthoringResult;
}

export async function listAuthoringResults(supabase: SupabaseClient<Database>, organizationId: string | null, lessonId?: string, offset = 0, courseId?: string) {
  const { data, error } = await supabase.rpc("admin_read_ai_results", {
    p_organization_id: organizationId ?? undefined, p_lesson_id: lessonId, p_offset: offset, p_course_id: courseId,
  });
  if (error) throw error;
  return data as unknown as AuthoringResults;
}
