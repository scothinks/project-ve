import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiGenerationClaim } from '@/features/ai-generation/data/jobs';
import type { Database, Json } from '@/types/database';
import { logAppError } from '@/lib/app-errors';
import { generateAssistance } from './assistance-provider.ts';
import { validateAssistance } from './assistance-validation.ts';
import type { AssistanceContext } from './assistance-contracts.ts';
export async function processAuthoringAssistance(supabase: SupabaseClient<Database>, job: AiGenerationClaim, workerId: string, generate = generateAssistance) {
  const checkpoint = async (action: string, candidate?: Json) => {
    const { data, error } = await supabase.rpc('service_ai_page_checkpoint', {
      p_job: job.id, p_worker: workerId, p_token: job.lock_token, p_version: job.lock_version, p_action: action, p_candidate: candidate,
    });
    if (error) throw error; return data;
  };
  try {
    if (generate === generateAssistance && !process.env.OPENAI_API_KEY) throw new Error('Generation unavailable before dispatch.');
    const context = await checkpoint('begin') as unknown as AssistanceContext;
    const candidate = validateAssistance(await generate(context), context);
    await checkpoint('ready', candidate as unknown as Json);
    return { status: 'completed' as const };
  } catch (error) {
    logAppError(error, { operation: 'admin.ai_authoring.assistance', resourceId: job.id });
    await checkpoint('failed').catch(error => logAppError(error, { operation: 'admin.ai_authoring.settle', resourceId: job.id }));
    return { status: 'failed' as const };
  }
}
