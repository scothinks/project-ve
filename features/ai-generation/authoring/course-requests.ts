import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { validateCourseOutline } from './course-validation.ts';
export async function quoteCourse(supabase: SupabaseClient<Database>, body: Record<string, unknown>, organizationId: string | null) {
  if (!['course_outline','course_draft'].includes(String(body.kind))
    || (body.parentId !== undefined && typeof body.parentId !== 'string')
    || (body.revision !== undefined && !Number.isSafeInteger(body.revision))
    || (body.questionsPerLesson !== undefined && (!Number.isSafeInteger(body.questionsPerLesson) || Number(body.questionsPerLesson)<0 || Number(body.questionsPerLesson)>3))
    || (body.refinement !== undefined && (typeof body.refinement !== 'string' || body.refinement.length>1000))
    || (body.retry !== undefined && typeof body.retry !== 'boolean')) throw Object.assign(new Error('Choose a valid course request.'),{code:'22023'});
  const { data, error } = await supabase.rpc('admin_quote_ai_course', {
    p_kind: String(body.kind), p_brief: body.brief as Json | undefined, p_parent_id: body.parentId as string | undefined,
    p_revision: body.revision as number | undefined, p_questions: Number(body.questionsPerLesson ?? 0),
    p_refinement: String(body.refinement ?? ''), p_retry: body.retry === true, p_organization_id: organizationId ?? undefined,
  });
  if (error) throw error; return data;
}
export async function saveCourseOutline(supabase: SupabaseClient<Database>, body: Record<string, unknown>) {
  if (typeof body.id !== 'string' || !Number.isSafeInteger(body.revision)) throw Object.assign(new Error('Reopen the outline before saving.'), {code:'22023'});
  let outline;
  try { outline = validateCourseOutline(body.outline); } catch(error) { throw Object.assign(error as Error,{code:'22023'}); }
  const {data,error}=await supabase.rpc('admin_save_ai_course_outline',{p_id:body.id,p_revision:Number(body.revision),p_outline:outline});
  if(error)throw error; return data;
}
