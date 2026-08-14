import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAiCoursePlanRow } from "@/features/learning/admin/data";

export type AdminAiActivityJob = {
  completed_at: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: string;
  error: string | null;
  final_charged_units?: number | null;
  id: string;
  job_type: string;
  operation_type?: string | null;
  organization_id?: string | null;
  reconciliation_status?: string | null;
  reserved_units?: number | null;
  status: string;
  updated_at: string;
};

export type AdminAiUsageRecord = {
  actual_internal_cost: number | null;
  actual_provider_cost: number | null;
  actor_user_id: string | null;
  completed_at: string | null;
  created_at: string;
  estimated_units: number;
  final_charged_units: number | null;
  id: string;
  operation_type: string;
  reconciliation_status: string;
  reserved_units: number;
  source_type: string;
  status: string;
};

export type AdminAiActivitySummary = {
  chargedUnits: number;
  completed: number;
  failed: number;
  needsReview: number;
  queued: number;
  releasedUnits: number;
  reservedUnits: number;
  running: number;
};

export type AdminAiActivity = {
  jobs: AdminAiActivityJob[];
  plansNeedingReview: AdminAiCoursePlanRow[];
  summary: AdminAiActivitySummary;
  usageRecords: AdminAiUsageRecord[];
};

function needsReviewPlan(plan: AdminAiCoursePlanRow) {
  return plan.status === "draft" || plan.status === "selected";
}

export async function getAdminAiActivity(
  supabase: SupabaseClient,
  options: {
    courseId?: string;
    limit?: number;
    plans?: AdminAiCoursePlanRow[];
  } = {},
): Promise<AdminAiActivity> {
  const limit = options.limit ?? 8;
  let jobsQuery = supabase
    .from("ai_generation_jobs")
    .select("id, entity_type, entity_id, job_type, status, error, created_at, updated_at, completed_at, organization_id, operation_type, reserved_units, final_charged_units, reconciliation_status")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.courseId) {
    jobsQuery = jobsQuery.eq("entity_id", options.courseId);
  }

  let usageQuery = supabase
    .from("organization_ai_usage_records")
    .select("id, source_type, operation_type, status, estimated_units, reserved_units, final_charged_units, actual_provider_cost, actual_internal_cost, reconciliation_status, actor_user_id, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.courseId) {
    usageQuery = usageQuery.eq("course_id", options.courseId);
  }

  const [{ data: jobsData, error: jobsError }, { data: usageData, error: usageError }] = await Promise.all([
    jobsQuery,
    usageQuery,
  ]);
  if (jobsError) throw jobsError;
  if (usageError) throw usageError;

  const jobs = (jobsData ?? []) as AdminAiActivityJob[];
  const usageRecords = (usageData ?? []) as AdminAiUsageRecord[];
  const plansNeedingReview = (options.plans ?? []).filter(needsReviewPlan);

  return {
    jobs,
    plansNeedingReview,
    summary: {
      chargedUnits: usageRecords.reduce((total, record) => total + Number(record.final_charged_units ?? 0), 0),
      completed: jobs.filter((job) => job.status === "completed").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      needsReview: plansNeedingReview.length,
      queued: jobs.filter((job) => job.status === "queued" || job.status === "pending").length,
      releasedUnits: usageRecords
        .filter((record) => record.status === "released")
        .reduce((total, record) => total + Number(record.reserved_units ?? 0), 0),
      reservedUnits: usageRecords
        .filter((record) => record.status === "reserved")
        .reduce((total, record) => total + Number(record.reserved_units ?? 0), 0),
      running: jobs.filter((job) => job.status === "running").length,
    },
    usageRecords,
  };
}
