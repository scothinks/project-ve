import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationLearnerWorkspaceContext } from "@/features/organizations/application/learner-workspace";
import type { Database } from "@/types/database";

type ProgrammeAssessmentRow = {
  assessment_version_id: string;
  completion_copy: string | null;
  introduction_copy: string | null;
  is_required: boolean;
  programme_id: string;
  sort_order: number;
};

type AssessmentVersionRow = {
  description: string | null;
  id: string;
  introduction_copy: string | null;
  owner_scope: string;
  slug: string;
  status: string;
  title: string;
  xp_award: number;
};

type ProgrammeRow = {
  id: string;
  title: string;
};

type AttemptRow = {
  assessment_version_id: string;
  completed_at: string | null;
  programme_id: string | null;
};

export type OrganizationLearnerAssessmentCheckpoint = {
  assessmentVersionId: string;
  completedAt: string | null;
  description: string | null;
  href: string;
  introductionCopy: string | null;
  isRequired: boolean;
  ownerScope: string;
  programmeId: string;
  programmeTitle: string;
  sortOrder: number;
  title: string;
  xpAward: number;
};

export async function getOrganizationLearnerAssessmentCheckpoints({
  hrefBuilder,
  supabase,
  userId,
  workspace,
}: {
  hrefBuilder: (checkpoint: { assessmentVersionId: string; programmeId: string }) => string;
  supabase: SupabaseClient<Database>;
  userId: string;
  workspace: OrganizationLearnerWorkspaceContext;
}): Promise<OrganizationLearnerAssessmentCheckpoint[]> {
  if (workspace.programmeIds.length === 0) {
    return [];
  }

  const { data: programmeAssessments, error: programmeAssessmentsError } = await supabase
    .from("programme_assessments")
    .select("programme_id, assessment_version_id, sort_order, is_required, introduction_copy, completion_copy")
    .in("programme_id", workspace.programmeIds)
    .order("sort_order", { ascending: true });

  if (programmeAssessmentsError) {
    throw programmeAssessmentsError;
  }

  const rows = (programmeAssessments ?? []) as ProgrammeAssessmentRow[];
  const assessmentIds = Array.from(new Set(rows.map((row) => row.assessment_version_id)));

  if (assessmentIds.length === 0) {
    return [];
  }

  const [assessmentsResult, programmesResult, attemptsResult] = await Promise.all([
    supabase
      .from("assessment_versions")
      .select("id, slug, title, description, introduction_copy, xp_award, status, owner_scope")
      .in("id", assessmentIds)
      .eq("status", "published"),
    supabase
      .from("programmes")
      .select("id, title")
      .in("id", workspace.programmeIds),
    supabase
      .from("user_assessment_attempts")
      .select("assessment_version_id, programme_id, completed_at")
      .eq("user_id", userId)
      .eq("organization_id", workspace.organizationId)
      .in("assessment_version_id", assessmentIds)
      .not("completed_at", "is", null),
  ]);

  if (assessmentsResult.error) throw assessmentsResult.error;
  if (programmesResult.error) throw programmesResult.error;
  if (attemptsResult.error) throw attemptsResult.error;

  const assessmentsById = new Map(
    ((assessmentsResult.data ?? []) as AssessmentVersionRow[]).map((assessment) => [assessment.id, assessment]),
  );
  const programmeTitles = new Map(
    ((programmesResult.data ?? []) as ProgrammeRow[]).map((programme) => [programme.id, programme.title]),
  );
  const completedAttempts = new Map(
    ((attemptsResult.data ?? []) as AttemptRow[]).map((attempt) => [
      `${attempt.programme_id ?? ""}:${attempt.assessment_version_id}`,
      attempt.completed_at,
    ]),
  );

  return rows.flatMap((row) => {
    const assessment = assessmentsById.get(row.assessment_version_id);

    if (!assessment) {
      return [];
    }

    return [{
      assessmentVersionId: assessment.id,
      completedAt: completedAttempts.get(`${row.programme_id}:${assessment.id}`) ?? null,
      description: assessment.description,
      href: hrefBuilder({ assessmentVersionId: assessment.id, programmeId: row.programme_id }),
      introductionCopy: row.introduction_copy || assessment.introduction_copy,
      isRequired: row.is_required,
      ownerScope: assessment.owner_scope,
      programmeId: row.programme_id,
      programmeTitle: programmeTitles.get(row.programme_id) ?? "Programme",
      sortOrder: row.sort_order,
      title: assessment.title,
      xpAward: assessment.xp_award,
    }];
  });
}
