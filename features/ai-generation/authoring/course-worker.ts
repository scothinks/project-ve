import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiGenerationClaim } from '@/features/ai-generation/data/jobs';
import type { Database, Json } from '@/types/database';
import { logAppError } from '@/lib/app-errors';
import { generateCourseCheckpoint } from './course-provider.ts';
import { validateCourseLesson, validateCourseOutline } from './course-validation.ts';
import type { CourseContext } from './course-contracts.ts';
export async function processAuthoringCourse(supabase: SupabaseClient<Database>, job: AiGenerationClaim, workerId: string, generate = generateCourseCheckpoint) {
  const checkpoint = async (action: string, candidate?: unknown) => {
    const { data, error } = await supabase.rpc('service_ai_course_checkpoint', {
      p_job: job.id, p_worker: workerId, p_token: job.lock_token, p_version: job.lock_version,
      p_action: action, p_candidate: candidate as Json | undefined,
    });
    if (error) throw error;
    return data as unknown as CourseContext | { done: true };
  };
  try {
    if (generate === generateCourseCheckpoint && !process.env.OPENAI_API_KEY) throw new Error('Generation unavailable before dispatch.');
    // One lease and budget envelope, at most six sequential 40-second calls.
    // The database fences each provider start and retains validated checkpoints.
    for (let i = 0; i < 6; i++) {
      const context = await checkpoint('begin');
      if ('done' in context) return { status: 'completed' as const };
      const value = await generate(context);
      const candidate = context.kind === 'course_outline' ? validateCourseOutline(value, context.brief.lessonCount) : validateCourseLesson(value, context);
      const state = await checkpoint('checkpoint', candidate);
      if ('done' in state) return { status: 'completed' as const };
    }
    return { status: 'completed' as const };
  } catch (error) {
    logAppError(error, { operation: 'admin.ai_authoring.course', resourceId: job.id });
    await checkpoint('failed').catch(error => logAppError(error, { operation: 'admin.ai_authoring.course_settle', resourceId: job.id }));
    return { status: 'failed' as const };
  }
}
