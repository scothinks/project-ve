import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminContext } from "@/features/admin/application/context";
import type { AiCourseGenerationInput } from "@/lib/ai-learning-generator";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Database, Json } from "@/types/database";

type AiMeteringClient = SupabaseClient<Database>;

export type OrganizationAiOperationType =
  | "ai_course_draft"
  | "ai_lesson_extension"
  | "ai_course_text_revision"
  | "ai_course_media_assets"
  | "ai_lesson_media_assets"
  | "ai_single_media_asset"
  | "ai_planner_new_course"
  | "ai_planner_expand_course";

export type OrganizationAiReservation = {
  usageRecordId: string;
  reservedUnits: number;
  status: string;
};

type ReservationRpcResult = {
  reservedUnits?: number;
  status?: string;
  usageRecordId?: string;
};

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

export function buildOrganizationAiIdempotencyKey(
  actorUserId: string,
  operationType: OrganizationAiOperationType,
  payload: Record<string, unknown>,
) {
  const digest = createHash("sha256")
    .update(stableStringify({ actorUserId, operationType, payload }))
    .digest("hex");

  return `organization_ai:${operationType}:${digest}`;
}

export function estimateCourseTextUnits(
  operationType: Extract<
    OrganizationAiOperationType,
    "ai_course_draft" | "ai_lesson_extension" | "ai_course_text_revision"
  >,
  input?: Partial<AiCourseGenerationInput>,
) {
  const lessonCount = Math.max(1, Math.min(12, Math.floor(input?.lessonCount ?? 4)));
  const questionsPerLesson = Math.max(0, Math.min(10, Math.floor(input?.questionsPerLesson ?? 3)));
  const base = operationType === "ai_course_text_revision" ? 60 : 100;

  return base + lessonCount * 35 + lessonCount * questionsPerLesson * 6;
}

export function estimateMediaUnits(
  operationType: Extract<
    OrganizationAiOperationType,
    "ai_course_media_assets" | "ai_lesson_media_assets" | "ai_single_media_asset"
  >,
  itemCount = 1,
) {
  const multiplier = operationType === "ai_single_media_asset" ? 1 : Math.max(1, Math.min(24, itemCount));
  return 75 * multiplier;
}

export function estimatePlannerUnits(
  operationType: Extract<OrganizationAiOperationType, "ai_planner_new_course" | "ai_planner_expand_course">,
  suggestionCount = 3,
) {
  return (operationType === "ai_planner_new_course" ? 45 : 35)
    + Math.max(1, Math.min(8, suggestionCount)) * 12;
}

export function getAdminWorkspaceOrganizationId(context: AdminContext) {
  return context.workspace.type === "organization" ? context.workspace.id : null;
}

export async function getCourseOrganizationId(
  supabase: AiMeteringClient,
  courseId: string,
) {
  if (!courseId) return null;

  const { data, error } = await supabase
    .from("courses")
    .select("organization_id")
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.organization_id === "string" ? data.organization_id : null;
}

export async function reserveOrganizationAiUsage(
  supabase: AiMeteringClient,
  args: {
    actorUserId: string;
    courseId?: string | null;
    estimatedUnits: number;
    idempotencyKey: string;
    lessonId?: string | null;
    metadata?: Record<string, unknown>;
    operationType: OrganizationAiOperationType;
    organizationId: string | null;
    sourceId: string;
    sourceType: "ai_generation_job" | "ai_course_plan";
  },
): Promise<OrganizationAiReservation | null> {
  if (!args.organizationId) {
    return null;
  }

  const { data, error } = await supabase.rpc("reserve_organization_ai_usage", {
    p_actor_user_id: args.actorUserId,
    p_assessment_id: undefined,
    p_course_id: args.courseId ?? undefined,
    p_estimated_provider_cost: undefined,
    p_estimated_units: args.estimatedUnits,
    p_idempotency_key: args.idempotencyKey,
    p_lesson_id: args.lessonId ?? undefined,
    p_metadata: (args.metadata ?? {}) as Json,
    p_mission_id: undefined,
    p_operation_type: args.operationType,
    p_organization_id: args.organizationId,
    p_programme_id: undefined,
    p_source_id: args.sourceId,
    p_source_type: args.sourceType,
  });

  if (error) throw error;
  const result = data as ReservationRpcResult;

  return {
    reservedUnits: Number(result.reservedUnits ?? args.estimatedUnits),
    status: result.status ?? "reserved",
    usageRecordId: String(result.usageRecordId ?? ""),
  };
}

export async function reconcileOrganizationAiUsage(
  _supabase: AiMeteringClient,
  reservation: OrganizationAiReservation | null,
  args: {
    failedJobChargePolicy?: string | null;
    failureCode?: string | null;
    finalChargedUnits?: number | null;
    metadata?: Record<string, unknown>;
    status: "charged" | "released";
  },
) {
  if (!reservation?.usageRecordId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("reconcile_organization_ai_usage", {
    p_actual_internal_cost: args.status === "charged"
      ? args.finalChargedUnits ?? reservation.reservedUnits
      : 0,
    p_actual_provider_cost: undefined,
    p_actual_provider_model: undefined,
    p_actual_provider_usage: {},
    p_failed_job_charge_policy: args.failedJobChargePolicy ?? undefined,
    p_failure_code: args.failureCode ?? undefined,
    p_final_charged_units: args.status === "charged"
      ? args.finalChargedUnits ?? reservation.reservedUnits
      : 0,
    p_metadata: (args.metadata ?? {}) as Json,
    p_status: args.status,
    p_usage_record_id: reservation.usageRecordId,
  });

  if (error) throw error;
}
