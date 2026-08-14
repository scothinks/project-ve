import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AdminLmsReportingSummary = {
  organizationId: string | null;
  programmeId: string | null;
  cohortId: string | null;
  unitId: string | null;
  assignedLearners: number;
  startedLearners: number;
  inProgressLearners: number;
  completedLearners: number;
  overdueLearners: number;
  averageCourseProgress: number;
  averageProgrammeProgress: number;
  averageQuizScore: number;
  missionAwards: number;
  rewardRedemptions: number;
  generatedAt: string;
};

export type AdminLmsCohortComparison = {
  cohortId: string;
  title: string;
  activeMembers: number;
  assignedLearners: number;
  completedLearners: number;
  overdueLearners: number;
  averageProgress: number;
};

export type AdminLmsLearnerReport = {
  userId: string;
  displayName: string | null;
  cohorts: Array<{ cohortId: string; title: string }>;
  assignedCount: number;
  startedCount: number;
  completedCount: number;
  overdueCount: number;
  averageCourseProgress: number;
  averageProgrammeProgress: number;
  averageQuizScore: number;
  missionAwards: number;
  rewardRedemptions: number;
  lastActivityAt: string | null;
};

export type AdminLmsQuizScoreReport = {
  quizId: string;
  title: string;
  attempts: number;
  averageScore: number;
};

export type AdminLmsMissionCompletionReport = {
  missionId: string;
  title: string;
  awards: number;
  assignedLearners: number;
  completionRate: number;
};

export type AdminLmsRewardUsageReport = {
  rewardId: string;
  title: string;
  redemptions: number;
  fulfilled: number;
  requested: number;
};

export type AdminLmsReporting = {
  summary: AdminLmsReportingSummary;
  cohortComparison: AdminLmsCohortComparison[];
  learners: AdminLmsLearnerReport[];
  quizScores: AdminLmsQuizScoreReport[];
  missionCompletion: AdminLmsMissionCompletionReport[];
  rewardUsage: AdminLmsRewardUsageReport[];
};

export type AdminLmsReportingFilters = {
  organizationId?: string | null;
  programmeId?: string | null;
  cohortId?: string | null;
  unitId?: string | null;
  limit?: number;
};

const emptySummary: AdminLmsReportingSummary = {
  organizationId: null,
  programmeId: null,
  cohortId: null,
  unitId: null,
  assignedLearners: 0,
  startedLearners: 0,
  inProgressLearners: 0,
  completedLearners: 0,
  overdueLearners: 0,
  averageCourseProgress: 0,
  averageProgrammeProgress: 0,
  averageQuizScore: 0,
  missionAwards: 0,
  rewardRedemptions: 0,
  generatedAt: new Date(0).toISOString(),
};

const emptyReport: AdminLmsReporting = {
  summary: emptySummary,
  cohortComparison: [],
  learners: [],
  quizScores: [],
  missionCompletion: [],
  rewardUsage: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function parseSummary(value: unknown): AdminLmsReportingSummary {
  const record = asRecord(value);

  return {
    organizationId: asString(record.organizationId),
    programmeId: asString(record.programmeId),
    cohortId: asString(record.cohortId),
    unitId: asString(record.unitId),
    assignedLearners: asNumber(record.assignedLearners),
    startedLearners: asNumber(record.startedLearners),
    inProgressLearners: asNumber(record.inProgressLearners),
    completedLearners: asNumber(record.completedLearners),
    overdueLearners: asNumber(record.overdueLearners),
    averageCourseProgress: asNumber(record.averageCourseProgress),
    averageProgrammeProgress: asNumber(record.averageProgrammeProgress),
    averageQuizScore: asNumber(record.averageQuizScore),
    missionAwards: asNumber(record.missionAwards),
    rewardRedemptions: asNumber(record.rewardRedemptions),
    generatedAt: asString(record.generatedAt) ?? new Date(0).toISOString(),
  };
}

export function parseAdminLmsReporting(value: unknown): AdminLmsReporting {
  const record = asRecord(value);

  return {
    ...emptyReport,
    summary: parseSummary(record.summary),
    cohortComparison: asArray<AdminLmsCohortComparison>(record.cohortComparison),
    learners: asArray<AdminLmsLearnerReport>(record.learners),
    quizScores: asArray<AdminLmsQuizScoreReport>(record.quizScores),
    missionCompletion: asArray<AdminLmsMissionCompletionReport>(record.missionCompletion),
    rewardUsage: asArray<AdminLmsRewardUsageReport>(record.rewardUsage),
  };
}

export async function getAdminLmsReporting(
  supabase: SupabaseClient<Database>,
  filters: AdminLmsReportingFilters = {},
): Promise<AdminLmsReporting> {
  const reportingArgs = {
    p_cohort_id: filters.cohortId || null,
    p_limit: filters.limit ?? 100,
    p_organization_id: filters.organizationId || null,
    p_programme_id: filters.programmeId || null,
    p_unit_id: filters.unitId || null,
  } as unknown as Database["public"]["Functions"]["admin_get_lms_reporting"]["Args"];

  const { data, error } = await supabase.rpc("admin_get_lms_reporting", reportingArgs);

  if (error) {
    throw error;
  }

  return parseAdminLmsReporting(data);
}
