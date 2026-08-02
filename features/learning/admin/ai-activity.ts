import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAiCoursePlanRow } from "@/features/learning/admin/data";

export type AdminAiActivityJob = {
  completed_at: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: string;
  error: string | null;
  id: string;
  job_type: string;
  status: string;
  updated_at: string;
};

export type AdminAiActivitySummary = {
  completed: number;
  failed: number;
  needsReview: number;
  queued: number;
  running: number;
};

export type AdminAiActivity = {
  jobs: AdminAiActivityJob[];
  plansNeedingReview: AdminAiCoursePlanRow[];
  summary: AdminAiActivitySummary;
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
  let query = supabase
    .from("ai_generation_jobs")
    .select("id, entity_type, entity_id, job_type, status, error, created_at, updated_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.courseId) {
    query = query.eq("entity_id", options.courseId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const jobs = (data ?? []) as AdminAiActivityJob[];
  const plansNeedingReview = (options.plans ?? []).filter(needsReviewPlan);

  return {
    jobs,
    plansNeedingReview,
    summary: {
      completed: jobs.filter((job) => job.status === "completed").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      needsReview: plansNeedingReview.length,
      queued: jobs.filter((job) => job.status === "queued" || job.status === "pending").length,
      running: jobs.filter((job) => job.status === "running").length,
    },
  };
}
