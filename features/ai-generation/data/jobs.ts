import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationAiOperationType } from "@/features/ai-generation/application/organization-ai-metering";
import { ValidationError } from "@/lib/app-errors";
import type { Database, Json } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

type AiGenerationJobType = "course_text" | "media_assets";

type AiGenerationJobStatus = "queued" | "running";

export type AiGenerationClaim = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  job_type: string;
  prompt: Record<string, unknown>;
  attempt_count: number;
  lock_token: string;
  lock_version: number;
};

export type AiGenerationLease = {
  jobId: string;
  lockToken: string;
  lockVersion: number;
  workerId: string;
};

export type AiGeneratedTreeRows = {
  lessonRows: Record<string, unknown>[];
  pageRows: Record<string, unknown>[];
  blockRows: Record<string, unknown>[];
  quizRows: Record<string, unknown>[];
  questionRows: Record<string, unknown>[];
  optionRows: Record<string, unknown>[];
  mediaRows: Record<string, unknown>[];
};

type AdminRpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type AdminRpcClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<AdminRpcResult<unknown>>;
};

export function isAiGenerationValidationFailure(error: unknown) {
  if (error instanceof ValidationError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; name?: unknown };
  return record.code === "VALIDATION_ERROR" || record.name === "ValidationError";
}

async function callAdminRpc<T>(
  supabase: AiGenerationAdminClient,
  functionName: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await (supabase as unknown as AdminRpcClient).rpc(functionName, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildAiGenerationJobIdempotencyKey(
  actorUserId: string,
  jobType: AiGenerationJobType,
  prompt: Record<string, unknown>,
  entityId: string | null,
) {
  const digest = createHash("sha256")
    .update(stableStringify({
      actorUserId,
      entityId,
      jobType,
      prompt,
    }))
    .digest("hex");

  return `ai_generation:${jobType}:${digest}`;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: unknown }).code === "23505",
  );
}

export async function createAiGenerationJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  jobType: AiGenerationJobType,
  prompt: Record<string, unknown>,
  options: {
    courseId?: string | null;
    entityId?: string | null;
    estimatedUnits?: number;
    lessonId?: string | null;
    operationType?: OrganizationAiOperationType;
    organizationId?: string | null;
    status?: AiGenerationJobStatus;
  } = {},
) {
  const entityId = options.entityId ?? null;
  const idempotencyKey = buildAiGenerationJobIdempotencyKey(actorUserId, jobType, prompt, entityId);

  if (options.organizationId && options.operationType && options.estimatedUnits) {
    const { data, error } = await supabase.rpc("create_organization_ai_generation_job", {
      p_actor_user_id: actorUserId,
      p_assessment_id: undefined,
      p_course_id: options.courseId ?? entityId ?? undefined,
      p_entity_id: entityId ?? "",
      p_estimated_provider_cost: undefined,
      p_estimated_units: options.estimatedUnits,
      p_idempotency_key: idempotencyKey,
      p_job_type: jobType,
      p_lesson_id: options.lessonId ?? undefined,
      p_mission_id: undefined,
      p_operation_type: options.operationType,
      p_organization_id: options.organizationId,
      p_programme_id: undefined,
      p_prompt: prompt as Json,
      p_status: options.status ?? "queued",
    });

    if (error) {
      throw error;
    }

    const result = data as { jobId?: string };
    if (!result.jobId) {
      throw new Error("Organization AI job creation did not return a job id.");
    }

    return result.jobId;
  }

  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .insert({
      entity_type: "course",
      entity_id: entityId,
      job_type: jobType,
      status: options.status ?? "running",
      prompt: prompt as Json,
      result: {},
      created_by: actorUserId,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (error) {
    if (isUniqueConstraintError(error)) {
      const { data: existingJob, error: existingJobError } = await supabase
        .from("ai_generation_jobs")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingJobError) throw existingJobError;

      const existingJobId = (existingJob as { id?: string } | null)?.id;
      if (existingJobId) {
        return existingJobId;
      }
    }

    throw error;
  }

  return (data as { id: string }).id;
}

export async function getAiGenerationJobActorUserId(
  supabase: AiGenerationAdminClient,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .select("created_by")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const createdBy = (data as { created_by?: string | null } | null)?.created_by;
  return typeof createdBy === "string" ? createdBy : "";
}

export async function claimNextAiGenerationJob(
  supabase: AiGenerationAdminClient,
  workerId: string,
) {
  const claimed = await callAdminRpc<AiGenerationClaim[]>(supabase, "claim_ai_generation_job", {
    p_worker_id: workerId,
    p_lease_seconds: 1800,
    p_max_attempts: 3,
  });

  return claimed[0] ?? null;
}

export async function heartbeatAiGenerationJob(
  supabase: AiGenerationAdminClient,
  lease: AiGenerationLease,
) {
  await callAdminRpc<void>(supabase, "heartbeat_ai_generation_job", {
    p_job_id: lease.jobId,
    p_worker_id: lease.workerId,
    p_lock_token: lease.lockToken,
    p_lock_version: lease.lockVersion,
    p_lease_seconds: 1800,
  });
}

export async function markAiGenerationJobFailed(
  supabase: AiGenerationAdminClient,
  jobId: string,
  workerId: string,
  lockToken: string,
  lockVersion: number,
  error: unknown,
  retry: boolean,
) {
  await callAdminRpc<void>(supabase, "fail_ai_generation_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_lock_token: lockToken,
    p_lock_version: lockVersion,
    p_error: error instanceof Error ? error.message : "AI generation job failed.",
    p_failure_code: isAiGenerationValidationFailure(error) ? "validation_error" : "worker_error",
    p_failure_detail: {
      name: error instanceof Error ? error.name : "UnknownError",
    },
    p_retry: retry,
  });
}

export async function completeAiGenerationJob(
  supabase: AiGenerationAdminClient,
  args: {
    entityId: string;
    error: string | null;
    jobId: string;
    result: Record<string, unknown>;
    status: "completed" | "failed";
    workerId: string;
    lockToken: string;
    lockVersion: number;
  },
) {
  await callAdminRpc<void>(supabase, "complete_ai_generation_job", {
    p_job_id: args.jobId,
    p_worker_id: args.workerId,
    p_lock_token: args.lockToken,
    p_lock_version: args.lockVersion,
    p_entity_id: args.entityId,
    p_status: args.status,
    p_result: args.result,
    p_error: args.error,
  });
}

export async function materializeAiCourseTextJob(
  supabase: AiGenerationAdminClient,
  args: {
    courseRow: Record<string, unknown> | null;
    courseUpdate: Record<string, unknown> | null;
    entityId: string;
    generatedTree: AiGeneratedTreeRows;
    jobId: string;
    jobResult: Record<string, unknown>;
    workerId: string;
    lockToken: string;
    lockVersion: number;
  },
) {
  await callAdminRpc<void>(supabase, "materialize_ai_course_text_job", {
    p_job_id: args.jobId,
    p_entity_id: args.entityId,
    p_course_row: args.courseRow,
    p_course_update: args.courseUpdate,
    p_lesson_rows: args.generatedTree.lessonRows,
    p_page_rows: args.generatedTree.pageRows,
    p_block_rows: args.generatedTree.blockRows,
    p_quiz_rows: args.generatedTree.quizRows,
    p_question_rows: args.generatedTree.questionRows,
    p_option_rows: args.generatedTree.optionRows,
    p_media_rows: args.generatedTree.mediaRows,
    p_job_result: args.jobResult,
    p_worker_id: args.workerId,
    p_lock_token: args.lockToken,
    p_lock_version: args.lockVersion,
  });
}

export async function replaceAiCourseTextJob(
  supabase: AiGenerationAdminClient,
  args: {
    courseUpdate: Record<string, unknown>;
    entityId: string;
    generatedTree: AiGeneratedTreeRows;
    jobId: string;
    jobResult: Record<string, unknown>;
    workerId: string;
    lockToken: string;
    lockVersion: number;
  },
) {
  await callAdminRpc<void>(supabase, "replace_ai_course_text_job", {
    p_job_id: args.jobId,
    p_entity_id: args.entityId,
    p_course_update: args.courseUpdate,
    p_lesson_rows: args.generatedTree.lessonRows,
    p_page_rows: args.generatedTree.pageRows,
    p_block_rows: args.generatedTree.blockRows,
    p_quiz_rows: args.generatedTree.quizRows,
    p_question_rows: args.generatedTree.questionRows,
    p_option_rows: args.generatedTree.optionRows,
    p_media_rows: args.generatedTree.mediaRows,
    p_job_result: args.jobResult,
    p_worker_id: args.workerId,
    p_lock_token: args.lockToken,
    p_lock_version: args.lockVersion,
  });
}
