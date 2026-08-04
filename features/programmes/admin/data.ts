import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AdminProgrammeOrganizationRow = {
  id: string;
  name: string;
  slug: string;
};

export type AdminProgrammeRow = {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  objective: string;
  intended_audience: string;
  status: Database["public"]["Enums"]["content_status"];
  schedule_starts_at: string | null;
  schedule_ends_at: string | null;
  completion_rules: Record<string, unknown>;
  reporting_config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  organization?: AdminProgrammeOrganizationRow | null;
  course_count?: number;
  mission_count?: number;
  reward_count?: number;
  assessment_count?: number;
};

export type AdminProgrammeCourseRow = {
  programme_id: string;
  course_id: string;
  sort_order: number;
  requirement: Database["public"]["Enums"]["programme_course_requirement"];
};

export type AdminProgrammeMissionRow = {
  programme_id: string;
  mission_id: string;
  sort_order: number;
};

export type AdminProgrammeRewardRow = {
  programme_id: string;
  reward_id: string;
  sort_order: number;
};

export type AdminProgrammeAssessmentRow = {
  programme_id: string;
  assessment_version_id: string;
  sort_order: number;
};

export type AdminAssessmentVersionOptionRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

export type AdminProgrammeDetail = AdminProgrammeRow & {
  assessments: AdminProgrammeAssessmentRow[];
  courses: AdminProgrammeCourseRow[];
  missions: AdminProgrammeMissionRow[];
  rewards: AdminProgrammeRewardRow[];
};

type ProgrammeSelectRow = AdminProgrammeRow & {
  organization?: AdminProgrammeOrganizationRow | AdminProgrammeOrganizationRow[] | null;
};

function normalizeProgramme(row: ProgrammeSelectRow): AdminProgrammeRow {
  const organization = Array.isArray(row.organization)
    ? row.organization[0] ?? null
    : row.organization ?? null;

  return {
    ...row,
    completion_rules: row.completion_rules ?? {},
    reporting_config: row.reporting_config ?? {},
    organization,
  };
}

function countByProgrammeId(rows: Array<{ programme_id: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.programme_id, (counts.get(row.programme_id) ?? 0) + 1);
  }
  return counts;
}

export async function getAdminProgrammes(
  supabase: SupabaseClient<Database>,
): Promise<AdminProgrammeRow[]> {
  const { data, error } = await supabase
    .from("programmes")
    .select(`
      id,
      organization_id,
      slug,
      title,
      objective,
      intended_audience,
      status,
      schedule_starts_at,
      schedule_ends_at,
      completion_rules,
      reporting_config,
      created_by,
      created_at,
      updated_at,
      organization:organizations!programmes_organization_id_fkey(id, name, slug)
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const programmes = ((data ?? []) as unknown as ProgrammeSelectRow[]).map(normalizeProgramme);
  const programmeIds = programmes.map((programme) => programme.id);

  if (programmeIds.length === 0) {
    return [];
  }

  const [coursesResult, missionsResult, rewardsResult, assessmentsResult] = await Promise.all([
    supabase.from("programme_courses").select("programme_id").in("programme_id", programmeIds),
    supabase.from("programme_missions").select("programme_id").in("programme_id", programmeIds),
    supabase.from("programme_rewards").select("programme_id").in("programme_id", programmeIds),
    supabase.from("programme_assessments").select("programme_id").in("programme_id", programmeIds),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (missionsResult.error) throw missionsResult.error;
  if (rewardsResult.error) throw rewardsResult.error;
  if (assessmentsResult.error) throw assessmentsResult.error;

  const courseCounts = countByProgrammeId((coursesResult.data ?? []) as Array<{ programme_id: string }>);
  const missionCounts = countByProgrammeId((missionsResult.data ?? []) as Array<{ programme_id: string }>);
  const rewardCounts = countByProgrammeId((rewardsResult.data ?? []) as Array<{ programme_id: string }>);
  const assessmentCounts = countByProgrammeId((assessmentsResult.data ?? []) as Array<{ programme_id: string }>);

  return programmes.map((programme) => ({
    ...programme,
    assessment_count: assessmentCounts.get(programme.id) ?? 0,
    course_count: courseCounts.get(programme.id) ?? 0,
    mission_count: missionCounts.get(programme.id) ?? 0,
    reward_count: rewardCounts.get(programme.id) ?? 0,
  }));
}

export async function getAdminProgramme(
  supabase: SupabaseClient<Database>,
  programmeId: string,
): Promise<AdminProgrammeDetail | null> {
  const { data, error } = await supabase
    .from("programmes")
    .select(`
      id,
      organization_id,
      slug,
      title,
      objective,
      intended_audience,
      status,
      schedule_starts_at,
      schedule_ends_at,
      completion_rules,
      reporting_config,
      created_by,
      created_at,
      updated_at,
      organization:organizations!programmes_organization_id_fkey(id, name, slug)
    `)
    .eq("id", programmeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [coursesResult, missionsResult, rewardsResult, assessmentsResult] = await Promise.all([
    supabase
      .from("programme_courses")
      .select("programme_id, course_id, sort_order, requirement")
      .eq("programme_id", programmeId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("programme_missions")
      .select("programme_id, mission_id, sort_order")
      .eq("programme_id", programmeId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("programme_rewards")
      .select("programme_id, reward_id, sort_order")
      .eq("programme_id", programmeId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("programme_assessments")
      .select("programme_id, assessment_version_id, sort_order")
      .eq("programme_id", programmeId)
      .order("sort_order", { ascending: true }),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (missionsResult.error) throw missionsResult.error;
  if (rewardsResult.error) throw rewardsResult.error;
  if (assessmentsResult.error) throw assessmentsResult.error;

  return {
    ...normalizeProgramme(data as unknown as ProgrammeSelectRow),
    assessments: (assessmentsResult.data ?? []) as AdminProgrammeAssessmentRow[],
    courses: (coursesResult.data ?? []) as AdminProgrammeCourseRow[],
    missions: (missionsResult.data ?? []) as AdminProgrammeMissionRow[],
    rewards: (rewardsResult.data ?? []) as AdminProgrammeRewardRow[],
  };
}

export async function getAdminAssessmentVersionOptions(
  supabase: SupabaseClient<Database>,
): Promise<AdminAssessmentVersionOptionRow[]> {
  const { data, error } = await supabase
    .from("assessment_versions")
    .select("id, slug, title, status")
    .order("title", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminAssessmentVersionOptionRow[];
}
