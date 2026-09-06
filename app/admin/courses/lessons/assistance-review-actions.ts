"use server";
import { requireAdmin } from '@/lib/admin';
import { revalidateLearningPaths } from '@/app/admin/courses/learning-cache';
import { redirect } from 'next/navigation';
export async function reviewAssistanceLesson(form: FormData) {
  const lessonId = String(form.get('lessonId') ?? '');
  const revision = Number(form.get('revision'));
  if (!lessonId || !Number.isSafeInteger(revision) || form.get('reviewed') !== 'on') throw new Error('Confirm your review first.');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc('admin_review_ai_assistance_lesson', { p_lesson_id: lessonId, p_revision: revision });
  if (error) throw error;
  const { data } = await supabase.from('lessons').select('course_id').eq('id', lessonId).single();
  if (data) revalidateLearningPaths(data.course_id, [lessonId]);
  redirect(`/admin/courses/lessons/${encodeURIComponent(lessonId)}/preview?section=review`);
}
