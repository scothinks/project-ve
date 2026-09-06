import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiGenerationClaim } from '@/features/ai-generation/data/jobs';
import type { Database, Json } from '@/types/database';
import { logAppError } from '@/lib/app-errors';
import { requestGeneratedImage } from '@/lib/ai-media-generator';
import { imagePrompt, type ImageStyle } from './image-style.ts';
export type ImageContext = { id: string; brief: string; style: ImageStyle; aspectRatio: string };
export async function processAuthoringImage(supabase: SupabaseClient<Database>, job: AiGenerationClaim, workerId: string, generate = requestGeneratedImage) {
  let stored = false;
  const checkpoint = async (action: string, file?: Json) => {
    const { data, error } = await supabase.rpc('service_ai_image_checkpoint', { p_job: job.id, p_worker: workerId, p_token: job.lock_token, p_version: job.lock_version, p_action: action, p_file: file });
    if (error) throw error; return data;
  };
  try {
    if (generate === requestGeneratedImage && !process.env.OPENAI_API_KEY) throw new Error('Image generation unavailable before dispatch.');
    const context = await checkpoint('begin') as unknown as ImageContext;
    const generated = await generate(imagePrompt(context), process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', context.aspectRatio === '1:1' ? '1024x1024' : '1536x1024');
    if (generated.bytes.length > 10485760 || generated.bytes.length < 8 || generated.bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Image output is not a supported PNG within 10 MB.');
    const path = `registry/authoring-${context.id}.png`;
    const uploaded = await supabase.storage.from('learning-media-private').upload(path, generated.bytes, { contentType: 'image/png', upsert: false });
    if (uploaded.error) throw uploaded.error;
    stored = true;
    // The ready transaction registers ownership, links the immutable version and
    // settles usage together. Never discard a paid stored file on uncertain RPC response.
    await checkpoint('ready', { path, size: generated.bytes.length });
    return { status: 'completed' as const };
  } catch (error) {
    logAppError(error, { operation: 'admin.ai_authoring.image', resourceId: job.id });
    // Leave the lease recoverable when registration's outcome is uncertain.
    // The existing worker recovery pass registers the stored file without buying
    // another image. If ready already committed, that terminal result wins.
    if (stored) return { status: 'failed' as const };
    await checkpoint('failed').catch(error => logAppError(error, { operation: 'admin.ai_authoring.image_settle', resourceId: job.id }));
    return { status: 'failed' as const };
  }
}
