"use server";
import { requireAdmin } from '@/lib/admin';
import { revalidatePath } from 'next/cache';
export async function setCourseArtwork(form: FormData) {
  const {supabase}=await requireAdmin();
  const course=String(form.get('courseId')??'');
  const match=/^\/api\/media\/([0-9a-f-]{36})$/.exec(String(form.get('url')??''));
  if(!match)throw new Error('Choose a stored image from the library or upload one.');
  const {error}=await supabase.rpc('admin_set_ai_course_artwork',{p_course:course,p_version:match[1],p_target:String(form.get('target')??'')});
  if(error)throw error;
  revalidatePath(`/admin/courses/${course}`);revalidatePath(`/admin/courses/${course}/review`);
}
