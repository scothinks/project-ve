import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AdminCourseRow } from "@/features/learning/admin/data";
import type { AdminProfileRow } from "@/features/users/admin/data";

export type AdminCohortOrganizationRow = {
  id: string;
  name: string;
  slug: string;
};

export type AdminCohortRow = {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  description: string;
  status: Database["public"]["Enums"]["content_status"];
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  organization?: AdminCohortOrganizationRow | null;
  active_member_count?: number;
  course_assignment_count?: number;
  programme_assignment_count?: number;
};

export type AdminCohortMemberRow = {
  cohort_id: string;
  user_id: string;
  status: Database["public"]["Enums"]["lms_participation_status"];
  added_by: string | null;
  created_at: string;
  updated_at: string;
  profile?: AdminProfileRow | null;
};

export type AdminCourseAssignmentRow = {
  id: string;
  organization_id: string;
  course_id: string;
  cohort_id: string | null;
  user_id: string | null;
  assignment_source: Database["public"]["Enums"]["lms_assignment_source"];
  due_at: string | null;
  status: Database["public"]["Enums"]["lms_participation_status"];
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  course?: Pick<AdminCourseRow, "catalog_scope" | "id" | "status" | "title"> | null;
  profile?: AdminProfileRow | null;
};

export type AdminProgrammeAssignmentRow = {
  id: string;
  organization_id: string;
  programme_id: string;
  cohort_id: string | null;
  user_id: string | null;
  assignment_source: Database["public"]["Enums"]["lms_assignment_source"];
  intake_starts_at: string | null;
  due_at: string | null;
  status: Database["public"]["Enums"]["lms_participation_status"];
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  programme?: {
    id: string;
    status: Database["public"]["Enums"]["content_status"];
    title: string;
  } | null;
  profile?: AdminProfileRow | null;
};

export type AdminEnrolmentRow = {
  id: string;
  organization_id: string;
  user_id: string;
  course_id: string | null;
  programme_id: string | null;
  assignment_source: Database["public"]["Enums"]["lms_assignment_source"];
  status: Database["public"]["Enums"]["lms_participation_status"];
  assigned_at: string;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  withdrawn_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  course?: Pick<AdminCourseRow, "id" | "title"> | null;
  programme?: {
    id: string;
    title: string;
  } | null;
  profile?: AdminProfileRow | null;
};

export type AdminCohortDetail = AdminCohortRow & {
  courseAssignments: AdminCourseAssignmentRow[];
  enrolments: AdminEnrolmentRow[];
  members: AdminCohortMemberRow[];
  programmeAssignments: AdminProgrammeAssignmentRow[];
};

type CohortSelectRow = AdminCohortRow & {
  organization?: AdminCohortOrganizationRow | AdminCohortOrganizationRow[] | null;
};

function normalizeCohort(row: CohortSelectRow): AdminCohortRow {
  const organization = Array.isArray(row.organization)
    ? row.organization[0] ?? null
    : row.organization ?? null;

  return {
    ...row,
    organization,
  };
}

function countByCohortId(rows: Array<{ cohort_id: string | null }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.cohort_id) continue;
    counts.set(row.cohort_id, (counts.get(row.cohort_id) ?? 0) + 1);
  }
  return counts;
}

export async function getAdminCohorts(
  supabase: SupabaseClient<Database>,
): Promise<AdminCohortRow[]> {
  const { data, error } = await supabase
    .from("cohorts")
    .select(`
      id,
      organization_id,
      slug,
      title,
      description,
      status,
      starts_at,
      ends_at,
      created_by,
      created_at,
      updated_at,
      organization:organizations!cohorts_organization_id_fkey(id, name, slug)
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const cohorts = ((data ?? []) as unknown as CohortSelectRow[]).map(normalizeCohort);
  const cohortIds = cohorts.map((cohort) => cohort.id);

  if (cohortIds.length === 0) {
    return [];
  }

  const [membersResult, coursesResult, programmesResult] = await Promise.all([
    supabase
      .from("cohort_members")
      .select("cohort_id")
      .in("cohort_id", cohortIds)
      .eq("status", "active"),
    supabase
      .from("course_assignments")
      .select("cohort_id")
      .in("cohort_id", cohortIds),
    supabase
      .from("programme_assignments")
      .select("cohort_id")
      .in("cohort_id", cohortIds),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (coursesResult.error) throw coursesResult.error;
  if (programmesResult.error) throw programmesResult.error;

  const memberCounts = countByCohortId((membersResult.data ?? []) as Array<{ cohort_id: string | null }>);
  const courseAssignmentCounts = countByCohortId((coursesResult.data ?? []) as Array<{ cohort_id: string | null }>);
  const programmeAssignmentCounts = countByCohortId((programmesResult.data ?? []) as Array<{ cohort_id: string | null }>);

  return cohorts.map((cohort) => ({
    ...cohort,
    active_member_count: memberCounts.get(cohort.id) ?? 0,
    course_assignment_count: courseAssignmentCounts.get(cohort.id) ?? 0,
    programme_assignment_count: programmeAssignmentCounts.get(cohort.id) ?? 0,
  }));
}

export async function getAdminCohort(
  supabase: SupabaseClient<Database>,
  cohortId: string,
): Promise<AdminCohortDetail | null> {
  const { data, error } = await supabase
    .from("cohorts")
    .select(`
      id,
      organization_id,
      slug,
      title,
      description,
      status,
      starts_at,
      ends_at,
      created_by,
      created_at,
      updated_at,
      organization:organizations!cohorts_organization_id_fkey(id, name, slug)
    `)
    .eq("id", cohortId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [membersResult, courseAssignmentsResult, programmeAssignmentsResult, enrolmentsResult] =
    await Promise.all([
      supabase
        .from("cohort_members")
        .select(`
          cohort_id,
          user_id,
          status,
          added_by,
          created_at,
          updated_at,
          profile:profiles!cohort_members_user_id_fkey(id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status)
        `)
        .eq("cohort_id", cohortId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("course_assignments")
        .select(`
          id,
          organization_id,
          course_id,
          cohort_id,
          user_id,
          assignment_source,
          due_at,
          status,
          assigned_by,
          created_at,
          updated_at,
          course:courses!course_assignments_course_id_fkey(id, title, status, catalog_scope),
          profile:profiles!course_assignments_user_id_fkey(id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status)
        `)
        .eq("cohort_id", cohortId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("programme_assignments")
        .select(`
          id,
          organization_id,
          programme_id,
          cohort_id,
          user_id,
          assignment_source,
          intake_starts_at,
          due_at,
          status,
          assigned_by,
          created_at,
          updated_at,
          programme:programmes!programme_assignments_programme_id_fkey(id, title, status),
          profile:profiles!programme_assignments_user_id_fkey(id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status)
        `)
        .eq("cohort_id", cohortId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("enrolments")
        .select(`
          id,
          organization_id,
          user_id,
          course_id,
          programme_id,
          assignment_source,
          status,
          assigned_at,
          due_at,
          started_at,
          completed_at,
          withdrawn_at,
          metadata,
          created_at,
          updated_at,
          course:courses!enrolments_course_id_fkey(id, title),
          programme:programmes!enrolments_programme_id_fkey(id, title),
          profile:profiles!enrolments_user_id_fkey(id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status)
        `)
        .eq("organization_id", (data as unknown as AdminCohortRow).organization_id)
        .contains("metadata", { cohortId })
        .order("updated_at", { ascending: false }),
    ]);

  if (membersResult.error) throw membersResult.error;
  if (courseAssignmentsResult.error) throw courseAssignmentsResult.error;
  if (programmeAssignmentsResult.error) throw programmeAssignmentsResult.error;
  if (enrolmentsResult.error) throw enrolmentsResult.error;

  return {
    ...normalizeCohort(data as unknown as CohortSelectRow),
    courseAssignments: (courseAssignmentsResult.data ?? []) as unknown as AdminCourseAssignmentRow[],
    enrolments: (enrolmentsResult.data ?? []) as unknown as AdminEnrolmentRow[],
    members: (membersResult.data ?? []) as unknown as AdminCohortMemberRow[],
    programmeAssignments: (programmeAssignmentsResult.data ?? []) as unknown as AdminProgrammeAssignmentRow[],
  };
}
