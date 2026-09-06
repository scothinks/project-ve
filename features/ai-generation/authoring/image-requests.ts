import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
export async function imageAuthoringRequest(supabase: SupabaseClient<Database>, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let result;
  if (body.action === 'imageSetup') {
    if (typeof body.target !== 'string' || typeof body.targetId !== 'string') throw { code: '22023', message: 'Choose an image destination.' };
    result = await supabase.rpc('admin_ai_image_setup', { p_target: body.target, p_target_id: body.targetId });
  } else if (body.action === 'imageStyle') {
    if (typeof body.courseId !== 'string') throw { code: '22023', message: 'Choose a saved course.' };
    result = await supabase.rpc('admin_save_ai_image_style', { p_course: body.courseId, p_style: body.style as Json });
  } else if (body.action === 'quote') {
    if (typeof body.target !== 'string' || typeof body.targetId !== 'string' || !Number.isSafeInteger(body.revision)
      || typeof body.brief !== 'string' || typeof body.altText !== 'string' || typeof body.caption !== 'string') throw { code: '22023', message: 'Complete the image brief and alt text.' };
    result = await supabase.rpc('admin_quote_ai_image', { p_target: body.target, p_target_id: body.targetId, p_revision: Number(body.revision), p_brief: body.brief, p_style: body.style as Json, p_alt: body.altText, p_caption: body.caption, p_parent: typeof body.parentId === 'string' ? body.parentId : undefined });
  } else if (body.action === 'apply' && typeof body.id === 'string') {
    const prepared = await supabase.rpc('admin_prepare_ai_image_apply', { p_id: body.id });
    if (prepared.error) throw prepared.error;
    result = await supabase.rpc('admin_apply_ai_image', { p_id: body.id });
  } else throw { code: '22023', message: 'Unknown image action.' };
  if (result.error) throw result.error;
  return (result.data ?? {}) as Record<string, unknown>;
}
