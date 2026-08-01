import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function createAiGenerationJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  jobType: AiGenerationJobType,
  prompt: Record<string, unknown>,
  options: {
    entityId?: string | null;
    status?: AiGenerationJobStatus;
  } = {},
) {
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .insert({
      entity_type: "course",
      entity_id: options.entityId ?? null,
      job_type: jobType,
      status: options.status ?? "running",
      prompt: prompt as Json,
      result: {},
      created_by: actorUserId,
    })
    .select("id")
    .single();

  if (error) throw error;
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

export async function markAiGenerationJobFailed(
  supabase: AiGenerationAdminClient,
  jobId: string,
  workerId: string,
  error: unknown,
  retry: boolean,
) {
  await callAdminRpc<void>(supabase, "fail_ai_generation_job", {
    p_job_id: jobId,
    p_error: error instanceof Error ? error.message : "AI generation job failed.",
    p_failure_code: isAiGenerationValidationFailure(error) ? "validation_error" : "worker_error",
    p_failure_detail: {
      name: error instanceof Error ? error.name : "UnknownError",
    },
    p_retry: retry,
    p_worker_id: workerId,
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
  },
) {
  await callAdminRpc<void>(supabase, "complete_ai_generation_job", {
    p_job_id: args.jobId,
    p_worker_id: args.workerId,
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
  });
}
