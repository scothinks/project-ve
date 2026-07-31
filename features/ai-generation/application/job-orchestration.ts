import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claimNextAiGenerationJob,
  createAiGenerationJob,
  isAiGenerationValidationFailure,
  markAiGenerationJobFailed,
} from "@/features/ai-generation/data/jobs";
import {
  getPromptString,
} from "@/features/ai-generation/application/job-prompts";
import {
  processCreateCourseTextJob,
  processExtendCourseTextJob,
  processReviseCourseTextJob,
} from "@/features/ai-generation/application/course-text-jobs";
import {
  processMediaAssetsJob,
} from "@/features/ai-generation/application/media-jobs";
import { logAppError, ValidationError } from "@/lib/app-errors";
import type { Database } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

type RevalidateLearningPaths = (courseId: string, lessonIds: string[]) => void;

export async function enqueueCourseTextJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  prompt: Record<string, unknown>,
  entityId?: string | null,
) {
  return createAiGenerationJob(supabase, actorUserId, "course_text", prompt, {
    entityId,
    status: "queued",
  });
}

export async function enqueueMediaAssetsJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  prompt: Record<string, unknown>,
  entityId: string,
) {
  return createAiGenerationJob(supabase, actorUserId, "media_assets", prompt, {
    entityId,
    status: "queued",
  });
}

export async function processNextAiGenerationJob(
  supabase: AiGenerationAdminClient,
  workerId: string,
  options: {
    revalidateLearningPaths: RevalidateLearningPaths;
  },
) {
  const job = await claimNextAiGenerationJob(supabase, workerId);

  if (!job) {
    return {
      processed: false,
      status: "idle" as const,
    };
  }

  try {
    if (job.job_type === "media_assets") {
      const result = await processMediaAssetsJob(supabase, job, {
        revalidateLearningPaths: options.revalidateLearningPaths,
      });

      return {
        jobId: job.id,
        processed: true,
        result,
        status: result.status === "failed" ? "failed" as const : "completed" as const,
      };
    }

    if (job.job_type !== "course_text") {
      throw new ValidationError(`Unsupported AI generation job type: ${job.job_type}`);
    }

    const mode = getPromptString(job.prompt, "mode");
    const result =
      mode === "create_course"
        ? await processCreateCourseTextJob(supabase, job)
        : mode === "extend_course"
          ? await processExtendCourseTextJob(supabase, job)
          : mode === "revise_course"
            ? await processReviseCourseTextJob(supabase, job)
            : (() => {
                throw new ValidationError(`Unsupported AI course text job mode: ${mode}`);
              })();

    options.revalidateLearningPaths(result.courseId, result.lessonIds);

    return {
      jobId: job.id,
      processed: true,
      result,
      status: "completed" as const,
    };
  } catch (error) {
    const isValidationError = isAiGenerationValidationFailure(error);
    const retry = !isValidationError && job.attempt_count < 3;
    await markAiGenerationJobFailed(supabase, job.id, error, retry).catch((failureError) => {
      logAppError(failureError, {
        operation: "admin.ai_generation_job.fail",
        resourceId: job.id,
      });
    });

    if (isValidationError) {
      return {
        jobId: job.id,
        processed: true,
        result: {
          error: error instanceof Error ? error.message : "AI generation job failed validation.",
          failureCode: "validation_error",
          retry,
        },
        status: "failed" as const,
      };
    }

    throw error;
  }
}
